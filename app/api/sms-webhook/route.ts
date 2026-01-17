import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Smart SMS Webhook - Zero Data Loss Architecture
 *
 * This endpoint stores ALL incoming SMS messages immediately, then returns success.
 * AI classification happens asynchronously via the MCP Server's SMS Parser tools.
 *
 * Flow:
 * 1. iOS Shortcut sends SMS → raw_messages table (always succeeds)
 * 2. MCP Server's processMessages() tool classifies and routes (async)
 * 3. Diana can query all message types (bookings, cancellations, reschedules)
 *
 * The MCP Server handles:
 * - classify_message: GPT-4 classification
 * - match_client: Fuzzy matching to existing clients
 * - create_booking_from_message: Creates booking + calendar sync
 * - cancel_booking, reschedule_booking: Lifecycle management
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function POST(req: NextRequest) {
  try {
    // Get user email from query params
    const userEmail = req.nextUrl.searchParams.get('user');

    if (!userEmail) {
      return NextResponse.json(
        { error: 'Missing user parameter' },
        { status: 400 }
      );
    }

    // Parse webhook payload - super flexible, accepts any format
    let payload: any;
    try {
      const bodyText = await req.text();
      try {
        payload = JSON.parse(bodyText);
      } catch {
        payload = { message: bodyText };
      }
    } catch (e) {
      console.error('Error reading request body:', e);
      return NextResponse.json({ error: 'Failed to read request body' }, { status: 400 });
    }

    // Extract message from payload - check common field names
    let message: string = '';
    const possibleFields = ['message', 'messag', 'msg', 'text', 'content', 'sms', 'body'];

    if (typeof payload === 'string') {
      message = payload;
    } else if (payload) {
      for (const field of possibleFields) {
        if (payload[field] && typeof payload[field] === 'string') {
          message = payload[field];
          break;
        }
      }
      if (!message) {
        for (const value of Object.values(payload)) {
          if (typeof value === 'string' && value.length > 5) {
            message = value;
            break;
          }
        }
      }
    }

    // Clean escape sequences
    message = message.replace(/\\([!'"?])/g, '$1');

    if (!message) {
      return NextResponse.json(
        { error: 'No message found', hint: 'Send JSON with a "message" field' },
        { status: 400 }
      );
    }

    const sender = payload?.sender || 'StyleSeat';

    console.log('📱 SMS received:', { userEmail, sender, preview: message.substring(0, 50) });

    // Look up user by email
    const { data: user, error: userError } = await supabase
      .from('user_tokens')
      .select('user_id')
      .eq('user_email', userEmail)
      .single();

    if (userError || !user) {
      console.log('❌ User not found:', userEmail);
      return NextResponse.json(
        { error: 'User not registered', details: 'Sign up at stylesync-pwa.vercel.app first' },
        { status: 404 }
      );
    }

    // Check for duplicate (same raw content in last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: existingMessage } = await supabase
      .from('raw_messages')
      .select('id')
      .eq('user_id', user.user_id)
      .eq('raw_content', message)
      .gte('created_at', fiveMinutesAgo)
      .single();

    if (existingMessage) {
      console.log('⚠️ Duplicate message, skipping:', existingMessage.id);
      return NextResponse.json({
        success: true,
        duplicate: true,
        message_id: existingMessage.id,
      });
    }

    // Store raw message immediately - ZERO DATA LOSS
    const { data: rawMessage, error: insertError } = await supabase
      .from('raw_messages')
      .insert({
        user_id: user.user_id,
        user_email: userEmail,
        raw_content: message,
        sender: sender,
        processed: false,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('❌ Failed to store message:', insertError);
      return NextResponse.json(
        { error: 'Failed to store message', details: insertError.message },
        { status: 500 }
      );
    }

    console.log('✅ Message stored:', rawMessage.id);

    // Return success immediately - AI processes async via /api/process-messages
    return NextResponse.json({
      success: true,
      message_id: rawMessage.id,
      status: 'queued_for_processing',
      hint: 'Message stored. AI will classify and route automatically.',
    });

  } catch (error: any) {
    console.error('❌ SMS webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// GET endpoint for status check
export async function GET(req: NextRequest) {
  const userEmail = req.nextUrl.searchParams.get('user');

  // If user provided, check their message stats
  if (userEmail) {
    const { data: user } = await supabase
      .from('user_tokens')
      .select('user_id')
      .eq('user_email', userEmail)
      .single();

    if (user) {
      const { count: totalMessages } = await supabase
        .from('raw_messages')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.user_id);

      const { count: pendingMessages } = await supabase
        .from('raw_messages')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.user_id)
        .eq('processed', false);

      return NextResponse.json({
        status: 'active',
        architecture: 'smart-parsing-v2',
        user: userEmail,
        stats: {
          total_messages: totalMessages || 0,
          pending_processing: pendingMessages || 0,
        },
        hint: 'POST SMS messages to this endpoint. AI processes them automatically.',
      });
    }
  }

  return NextResponse.json({
    status: 'active',
    architecture: 'smart-parsing-v2',
    usage: 'POST SMS data with ?user=email parameter',
    features: [
      'Zero data loss - stores ALL messages',
      'AI classification (booking, cancellation, reschedule, etc.)',
      'Automatic calendar sync',
      'Client normalization with fuzzy matching',
    ],
  });
}
