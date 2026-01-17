/**
 * Agent Discovery API
 *
 * GET /api/agents/discover?domain=salon&capabilities=booking.create&certification_min=uscp-1
 *
 * Discovers certified agents in the network.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const domain = searchParams.get('domain');
    const capabilities = searchParams.get('capabilities')?.split(',') || [];
    const certificationMin = searchParams.get('certification_min');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Build query
    let query = supabase
      .from('agent_registry')
      .select('agent_id, display_name, version, certification_level, certification_expires, endpoint, capabilities, domain')
      .eq('status', 'active');

    // Apply filters
    if (domain) {
      query = query.eq('domain', domain);
    }

    if (capabilities.length > 0) {
      query = query.overlaps('capabilities', capabilities);
    }

    if (certificationMin) {
      const levels = ['uncertified', 'uscp-1', 'uscp-2', 'uscp-enterprise'];
      const minIndex = levels.indexOf(certificationMin);
      if (minIndex > 0) {
        query = query.in('certification_level', levels.slice(minIndex));
      }
    }

    query = query.limit(limit);

    const { data: agents, error } = await query;

    if (error) {
      console.error('Discovery error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Transform to expected format
    const formattedAgents = (agents || []).map((agent) => ({
      agent_id: agent.agent_id,
      display_name: agent.display_name,
      version: agent.version,
      certification_level: agent.certification_level,
      certification_expires: agent.certification_expires,
      endpoint: agent.endpoint,
    }));

    return NextResponse.json({
      success: true,
      agents: formattedAgents,
      count: formattedAgents.length,
    });
  } catch (error) {
    console.error('Discovery error:', error);
    return NextResponse.json(
      { success: false, error: 'Discovery failed' },
      { status: 500 }
    );
  }
}
