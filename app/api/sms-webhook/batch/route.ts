import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Import the parser from the single message webhook
// (We'll need to extract parseStyleSeatSMS to a shared utility later)

interface ParsedBooking {
  customer_name: string;
  service: string;
  appointment_time: string;
  confidence: number;
}

export async function POST(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('user');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing user ID parameter' },
        { status: 400 }
      );
    }

    // Parse the batch payload
    const body = await req.json();
    const messages: string[] = Array.isArray(body.messages) ? body.messages : [];

    if (messages.length === 0) {
      return NextResponse.json(
        { error: 'No messages provided', hint: 'Send { "messages": ["msg1", "msg2", ...] }' },
        { status: 400 }
      );
    }

    console.log(`📱 Batch webhook received: ${messages.length} messages for user ${userId}`);

    // Process each message
    const results = {
      total: messages.length,
      new_bookings: 0,
      already_synced: 0,
      parse_failed: 0,
      bookings: [] as any[]
    };

    for (const message of messages) {
      try {
        // Create hash for deduplication
        const messageHash = crypto.createHash('md5').update(message).digest('hex');

        // Check if already synced
        const { data: existing } = await supabase
          .from('synced_messages')
          .select('message_hash')
          .eq('message_hash', messageHash)
          .eq('user_id', userId)
          .single();

        if (existing) {
          results.already_synced++;
          continue;
        }

        // Parse the booking
        const booking = parseStyleSeatSMS(message);

        if (!booking) {
          results.parse_failed++;
          console.log(`⚠️ Failed to parse message: ${message.substring(0, 50)}...`);
          continue;
        }

        // Save booking to database
        const { data: savedBooking, error: bookingError } = await supabase
          .from('salon_bookings')
          .insert({
            user_id: userId,
            customer_name: booking.customer_name,
            service: booking.service,
            appointment_time: booking.appointment_time,
            duration_minutes: 60,
            confidence: booking.confidence,
            raw_email: message, // Store SMS in raw_email field
            synced: false,
            sync_method: 'ios_sms_batch',
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (bookingError) {
          console.error('❌ Error saving booking:', bookingError);
          results.parse_failed++;
          continue;
        }

        // Mark message as synced
        await supabase
          .from('synced_messages')
          .insert({
            message_hash: messageHash,
            user_id: userId,
            synced_at: new Date().toISOString(),
          });

        results.new_bookings++;
        results.bookings.push({
          customer: booking.customer_name,
          service: booking.service,
          time: booking.appointment_time,
        });

      } catch (error) {
        console.error('❌ Error processing message:', error);
        results.parse_failed++;
      }
    }

    console.log(`✅ Batch complete: ${results.new_bookings} new, ${results.already_synced} skipped, ${results.parse_failed} failed`);

    return NextResponse.json({
      success: true,
      summary: `${results.new_bookings} new bookings synced${results.already_synced > 0 ? `, ${results.already_synced} already existed` : ''}${results.parse_failed > 0 ? `, ${results.parse_failed} failed to parse` : ''}`,
      details: results,
    });

  } catch (error: any) {
    console.error('❌ Batch webhook error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message
      },
      { status: 500 }
    );
  }
}

// TODO: Extract this to a shared utility file
function parseStyleSeatSMS(message: string): ParsedBooking | null {
  try {
    // Clean up escape sequences
    message = message.replace(/\\([!'"?])/g, '$1');

    const patterns = {
      customer1: /booked!\s+([A-Za-z][A-Za-z\-]+(?:\s+[A-Za-z][A-Za-z\-]+)+?)\s+scheduled/i,
      service1: /scheduled\s+a\s+(.+?)\s+with\s+you\s+on/i,
      date1: /with\s+you\s+on\s+([A-Z][a-z]+\s+\d{1,2})/i,
      time1: /at\s+(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/i,
    };

    let customer_name = '';
    let service = '';
    let dateStr = '';
    let timeStr = '';
    let confidence = 0;

    // Extract customer
    const customerMatch = message.match(patterns.customer1);
    if (customerMatch) {
      customer_name = customerMatch[1].trim();
      confidence += 0.3;
    }

    // Extract service
    const serviceMatch = message.match(patterns.service1);
    if (serviceMatch) {
      service = serviceMatch[1].trim();
      confidence += 0.3;
    }

    // Extract date
    const dateMatch = message.match(patterns.date1);
    if (dateMatch) {
      dateStr = dateMatch[1].trim();
      confidence += 0.2;
    }

    // Extract time
    const timeMatch = message.match(patterns.time1);
    if (timeMatch) {
      timeStr = timeMatch[1].trim();
      confidence += 0.2;
    }

    if (!customer_name || !timeStr) {
      return null;
    }

    // Simple date parsing (assuming current year if not specified)
    const now = new Date();
    const currentYear = now.getFullYear();
    const appointmentTimeStr = dateStr ? `${dateStr}, ${currentYear} ${timeStr}` : timeStr;
    const appointmentDate = new Date(appointmentTimeStr);

    if (isNaN(appointmentDate.getTime())) {
      return null;
    }

    return {
      customer_name,
      service: service || 'Unknown Service',
      appointment_time: appointmentDate.toISOString(),
      confidence,
    };

  } catch (error) {
    console.error('❌ Error parsing SMS:', error);
    return null;
  }
}

// GET endpoint for testing
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('user');

  return NextResponse.json({
    message: 'StyleSync Batch SMS Webhook Endpoint',
    status: 'active',
    usage: 'POST an array of messages: { "messages": ["msg1", "msg2", ...] }',
    userId: userId || 'not provided',
  });
}
