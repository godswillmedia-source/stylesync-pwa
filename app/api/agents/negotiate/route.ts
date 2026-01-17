/**
 * Agent Negotiation API
 *
 * POST /api/agents/negotiate
 * Body: { target_agent_id: string, requested_capabilities: string[] }
 *
 * Negotiates capabilities with a target agent and returns a session token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REQUESTING_AGENT_ID = 'stylesync_ios_app';

// Capabilities that can be granted
const GRANTABLE_CAPABILITIES = [
  {
    capability_id: 'booking.create',
    description: 'Create a new booking',
    requires_auth: true,
  },
  {
    capability_id: 'booking.query',
    description: 'Query existing bookings',
    requires_auth: true,
  },
  {
    capability_id: 'calendar.availability',
    description: 'Check calendar availability',
    requires_auth: true,
  },
  {
    capability_id: 'client.lookup',
    description: 'Look up client information',
    requires_auth: true,
  },
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { target_agent_id, requested_capabilities } = body;

    if (!target_agent_id || !requested_capabilities?.length) {
      return NextResponse.json(
        { success: false, error: 'Missing target_agent_id or requested_capabilities' },
        { status: 400 }
      );
    }

    // Get target agent
    const { data: targetAgent, error: agentError } = await supabase
      .from('agent_registry')
      .select('*')
      .eq('agent_id', target_agent_id)
      .eq('status', 'active')
      .single();

    if (agentError || !targetAgent) {
      return NextResponse.json({
        status: 'rejected',
        granted_capabilities: [],
        denied_capabilities: requested_capabilities.map((c: string) => ({
          capability_id: c,
          reason: 'not_available',
          message: 'Target agent not found or inactive',
        })),
        error: 'Agent not found',
      });
    }

    // Check certification
    if (targetAgent.certification_level === 'uncertified') {
      return NextResponse.json({
        status: 'rejected',
        granted_capabilities: [],
        denied_capabilities: requested_capabilities.map((c: string) => ({
          capability_id: c,
          reason: 'not_certified',
          message: 'Agent is not certified',
        })),
        error: 'Agent not certified',
      });
    }

    // Match capabilities
    const granted: typeof GRANTABLE_CAPABILITIES = [];
    const denied: Array<{ capability_id: string; reason: string; message: string }> = [];

    for (const capId of requested_capabilities) {
      const capability = GRANTABLE_CAPABILITIES.find((c) => c.capability_id === capId);

      if (capability && targetAgent.capabilities?.includes(capId)) {
        granted.push(capability);
      } else {
        denied.push({
          capability_id: capId,
          reason: 'not_available',
          message: `Capability '${capId}' not available from this agent`,
        });
      }
    }

    // Determine status
    let status: 'accepted' | 'partial' | 'rejected';
    if (granted.length === requested_capabilities.length) {
      status = 'accepted';
    } else if (granted.length > 0) {
      status = 'partial';
    } else {
      status = 'rejected';
    }

    // Create session if capabilities granted
    let sessionToken: string | undefined;
    let sessionExpires: string | undefined;

    if (granted.length > 0) {
      sessionToken = uuidv4();
      sessionExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      await supabase.from('agent_sessions').insert({
        session_token: sessionToken,
        agent_id: REQUESTING_AGENT_ID,
        granted_capabilities: granted.map((c) => c.capability_id),
        expires_at: sessionExpires,
        status: 'active',
      });
    }

    // Log negotiation
    await supabase.from('us_telemetry').insert({
      event_id: uuidv4(),
      timestamp: new Date().toISOString(),
      agent_id: REQUESTING_AGENT_ID,
      event_type: 'agent.negotiation',
      result: status === 'rejected' ? 'error' : 'success',
      metadata: {
        target_agent: target_agent_id,
        requested: requested_capabilities,
        granted_count: granted.length,
        denied_count: denied.length,
      },
    });

    return NextResponse.json({
      status,
      granted_capabilities: granted,
      denied_capabilities: denied.length > 0 ? denied : undefined,
      session_token: sessionToken,
      session_expires: sessionExpires,
    });
  } catch (error) {
    console.error('Negotiation error:', error);
    return NextResponse.json(
      { success: false, error: 'Negotiation failed' },
      { status: 500 }
    );
  }
}
