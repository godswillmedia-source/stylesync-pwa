/**
 * Agent Request API
 *
 * POST /api/agents/request
 * Headers: X-Session-Token: <session_token>
 * Body: { target_agent_id: string, capability_id: string, request_data: object }
 *
 * Sends a request to another agent using an established session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const correlationId = uuidv4();

  try {
    const sessionToken = request.headers.get('X-Session-Token');
    const body = await request.json();
    const { target_agent_id, capability_id, request_data } = body;

    // Validate session
    if (!sessionToken) {
      return NextResponse.json({
        success: false,
        correlation_id: correlationId,
        error: { code: 'NO_SESSION', message: 'Session token required' },
        processing_time_ms: Date.now() - startTime,
      });
    }

    const { data: session, error: sessionError } = await supabase
      .from('agent_sessions')
      .select('*')
      .eq('session_token', sessionToken)
      .eq('status', 'active')
      .single();

    if (sessionError || !session) {
      return NextResponse.json({
        success: false,
        correlation_id: correlationId,
        error: { code: 'INVALID_SESSION', message: 'Invalid or expired session' },
        processing_time_ms: Date.now() - startTime,
      });
    }

    // Check session expiry
    if (new Date(session.expires_at) < new Date()) {
      await supabase
        .from('agent_sessions')
        .update({ status: 'expired' })
        .eq('session_token', sessionToken);

      return NextResponse.json({
        success: false,
        correlation_id: correlationId,
        error: { code: 'SESSION_EXPIRED', message: 'Session has expired' },
        processing_time_ms: Date.now() - startTime,
      });
    }

    // Check capability is granted
    if (!session.granted_capabilities?.includes(capability_id)) {
      return NextResponse.json({
        success: false,
        correlation_id: correlationId,
        error: { code: 'CAPABILITY_NOT_GRANTED', message: `Capability '${capability_id}' not granted in this session` },
        processing_time_ms: Date.now() - startTime,
      });
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
        success: false,
        correlation_id: correlationId,
        error: { code: 'AGENT_NOT_FOUND', message: 'Target agent not found' },
        processing_time_ms: Date.now() - startTime,
      });
    }

    // Record transaction start
    await supabase.from('agent_transactions').insert({
      transaction_id: correlationId,
      initiator_agent: session.agent_id,
      responder_agent: target_agent_id,
      capability_id,
      status: 'processing',
      request_payload: request_data,
    });

    // Route request to target agent
    let result: Record<string, any>;

    try {
      const agentResponse = await fetch(`${targetAgent.endpoint}/agent/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': sessionToken,
          'X-Correlation-ID': correlationId,
        },
        body: JSON.stringify({
          capability_id,
          request_data,
          correlation_id: correlationId,
        }),
      });

      if (!agentResponse.ok) {
        throw new Error(`Agent returned ${agentResponse.status}`);
      }

      result = await agentResponse.json();
    } catch (fetchError) {
      // If direct agent call fails, try local handling for demo purposes
      result = await handleLocalRequest(capability_id, request_data, correlationId);
    }

    // Update transaction
    await supabase
      .from('agent_transactions')
      .update({
        status: 'completed',
        response_payload: result,
        completed_at: new Date().toISOString(),
        processing_time_ms: Date.now() - startTime,
      })
      .eq('transaction_id', correlationId);

    // Update session usage
    await supabase
      .from('agent_sessions')
      .update({
        last_used: new Date().toISOString(),
        request_count: session.request_count + 1,
      })
      .eq('session_token', sessionToken);

    // Log telemetry
    await supabase.from('us_telemetry').insert({
      event_id: uuidv4(),
      timestamp: new Date().toISOString(),
      agent_id: session.agent_id,
      event_type: 'agent.request',
      tool: capability_id,
      result: 'success',
      latency_ms: Date.now() - startTime,
      metadata: { target_agent: target_agent_id, correlation_id: correlationId },
    });

    return NextResponse.json({
      success: true,
      correlation_id: correlationId,
      result,
      processing_time_ms: Date.now() - startTime,
    });
  } catch (error) {
    console.error('Request error:', error);

    return NextResponse.json({
      success: false,
      correlation_id: correlationId,
      error: {
        code: 'REQUEST_FAILED',
        message: error instanceof Error ? error.message : 'Request failed',
      },
      processing_time_ms: Date.now() - startTime,
    });
  }
}

/**
 * Handle requests locally for demo/fallback
 */
async function handleLocalRequest(
  capabilityId: string,
  requestData: Record<string, any>,
  correlationId: string
): Promise<Record<string, any>> {
  switch (capabilityId) {
    case 'booking.create':
      return handleBookingCreate(requestData);

    case 'booking.query':
      return handleBookingQuery(requestData);

    case 'calendar.availability':
      return handleCalendarAvailability(requestData);

    case 'client.lookup':
      return handleClientLookup(requestData);

    default:
      throw new Error(`Unknown capability: ${capabilityId}`);
  }
}

async function handleBookingCreate(data: Record<string, any>) {
  const { data: booking, error } = await supabase
    .from('salon_bookings')
    .insert({
      id: uuidv4(),
      customer_name: data.client_name,
      service: data.service,
      appointment_time: data.date_time,
      duration_minutes: data.duration_minutes || 60,
      notes: data.notes,
      status: 'confirmed',
      created_via: 'agent_protocol',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  return {
    booking_id: booking.id,
    success: true,
    message: `Booking created for ${data.client_name}`,
  };
}

async function handleBookingQuery(data: Record<string, any>) {
  let query = supabase
    .from('salon_bookings')
    .select('*')
    .order('appointment_time', { ascending: true });

  if (data.date_from) {
    query = query.gte('appointment_time', data.date_from);
  }
  if (data.date_to) {
    query = query.lte('appointment_time', data.date_to);
  }
  if (data.client_name) {
    query = query.ilike('customer_name', `%${data.client_name}%`);
  }

  const { data: bookings, error } = await query.limit(data.limit || 50);

  if (error) throw new Error(error.message);

  return { bookings: bookings || [], count: bookings?.length || 0 };
}

async function handleCalendarAvailability(data: Record<string, any>) {
  const { data: bookings, error } = await supabase
    .from('salon_bookings')
    .select('appointment_time, duration_minutes')
    .gte('appointment_time', data.date_from)
    .lte('appointment_time', data.date_to)
    .eq('status', 'confirmed');

  if (error) throw new Error(error.message);

  const busySlots = (bookings || []).map((b) => ({
    start: b.appointment_time,
    end: new Date(
      new Date(b.appointment_time).getTime() + (b.duration_minutes || 60) * 60000
    ).toISOString(),
  }));

  return { available_slots: [], busy_slots: busySlots };
}

async function handleClientLookup(data: Record<string, any>) {
  let query = supabase.from('clients').select('*');

  if (data.client_id) {
    query = query.eq('id', data.client_id);
  } else if (data.client_name) {
    query = query.ilike('canonical_name', `%${data.client_name}%`);
  }

  const { data: client } = await query.limit(1).single();

  return { client: client || null, booking_history: [] };
}
