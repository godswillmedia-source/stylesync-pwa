import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// TEST MODE: Skip Supabase if keys not configured
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';
const TEST_MODE = false; // PRODUCTION MODE - saves to database

const supabase = TEST_MODE ? null : createClient(SUPABASE_URL, SUPABASE_KEY);

interface ParsedBooking {
  customer_name: string;
  service: string;
  appointment_time: string;
  confidence: number;
}

export async function POST(req: NextRequest) {
  try {
    // Get user ID from query params
    const userId = req.nextUrl.searchParams.get('user');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing user ID parameter' },
        { status: 400 }
      );
    }

    // Parse webhook payload from iOS Shortcut
    // Super flexible - accepts almost any format
    let payload: any;
    try {
      // Clone the request so we can read it twice if needed
      const bodyText = await req.text();
      try {
        payload = JSON.parse(bodyText);
      } catch {
        // Not JSON, treat as plain text message
        payload = { message: bodyText };
      }
    } catch (e) {
      console.error('Error reading request body:', e);
      return NextResponse.json({ error: 'Failed to read request body' }, { status: 400 });
    }

    console.log('📱 Raw payload received:', JSON.stringify(payload));

    // Find the message - check common field names
    let message: string = '';
    const possibleFields = ['message', 'messag', 'msg', 'text', 'content', 'sms', 'body'];

    if (typeof payload === 'string') {
      message = payload;
    } else if (payload) {
      // Try each possible field name
      for (const field of possibleFields) {
        if (payload[field] && typeof payload[field] === 'string') {
          message = payload[field];
          break;
        }
      }
      // If still no message, grab any long string from the payload
      if (!message) {
        for (const value of Object.values(payload)) {
          if (typeof value === 'string' && value.length > 5) {
            message = value;
            break;
          }
        }
      }
    }

    if (!message) {
      console.error('❌ Could not find message in payload:', payload);
      return NextResponse.json(
        { error: 'No message found', received: payload, hint: 'Send JSON with a "message" field containing the SMS text' },
        { status: 400 }
      );
    }

    const sender = payload?.sender || 'StyleSeat';
    const timestamp = new Date().toISOString();

    console.log('📱 iOS SMS Webhook received:', {
      userId,
      sender,
      messagePreview: message.substring(0, 50),
      timestamp,
      testMode: TEST_MODE,
    });

    // Look up user by email (userId param is actually an email)
    let user;
    const userEmail = userId; // The "user" param is actually an email address

    if (TEST_MODE) {
      console.log('⚠️ TEST MODE: Skipping database validation');
      user = {
        user_id: userEmail,
        user_email: userEmail,
        sms_sender_number: sender,
        access_token: 'test-token'
      };
    } else {
      // Try to find user by email
      const { data: userData, error: userError } = await supabase!
        .from('user_tokens')
        .select('user_id, user_email, sms_sender_number, access_token')
        .eq('user_email', userEmail)
        .single();

      if (userError || !userData) {
        // User not in database yet - that's OK, create a minimal user object
        console.log('ℹ️ User not in database, proceeding anyway:', userEmail);
        user = {
          user_id: userEmail,
          user_email: userEmail,
          sms_sender_number: null,
          access_token: null
        };
      } else {
        user = userData;
      }

      // Optional: Verify sender matches saved StyleSeat number
      if (user.sms_sender_number && sender !== user.sms_sender_number) {
        console.warn('⚠️ SMS from unexpected sender:', {
          expected: user.sms_sender_number,
          actual: sender,
        });
        // Don't block - user might have multiple booking sources
      }
    }

    // Parse booking details from SMS
    const booking = parseStyleSeatSMS(message);

    if (!booking) {
      console.error('❌ Could not parse booking from SMS:', message);
      // Debug: test the patterns directly
      const testCustomer = message.match(/booked!\s+([A-Za-z][A-Za-z\-]+(?:\s+[A-Za-z][A-Za-z\-]+)+?)\s+scheduled/i);
      const testTime = message.match(/at\s+(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/i);
      // Check character codes around "booked" to debug encoding
      const bookedIdx = message.indexOf('booked');
      let charCodes = '';
      if (bookedIdx >= 0) {
        for (let i = bookedIdx; i < Math.min(bookedIdx + 10, message.length); i++) {
          charCodes += message.charCodeAt(i) + ',';
        }
      }
      return NextResponse.json(
        {
          error: 'Could not parse booking details from SMS',
          message: 'SMS format not recognized as a booking confirmation',
          received_message: message.substring(0, 200), // Show what we actually got
          debug: {
            message_length: message.length,
            customer_match: testCustomer ? testCustomer[1] : null,
            time_match: testTime ? testTime[1] : null,
            has_booked: message.includes('booked'),
            has_booked_exclaim: message.includes('booked!'),
            has_scheduled: message.includes('scheduled'),
            booked_index: bookedIdx,
            char_codes_after_booked: charCodes,
          }
        },
        { status: 400 }
      );
    }

    console.log('✅ Booking parsed:', booking);

    // Store the booking in database
    let savedBooking;
    if (TEST_MODE) {
      console.log('⚠️ TEST MODE: Skipping database save');
      savedBooking = {
        id: 'test-booking-' + Date.now(),
        user_id: userEmail,
        customer_name: booking.customer_name,
        service: booking.service,
        appointment_time: booking.appointment_time,
        duration_minutes: 60,
        confidence: booking.confidence,
        created_at: new Date().toISOString(),
      };
    } else {
      const { data, error: bookingError } = await supabase!
        .from('salon_bookings')
        .insert({
          user_id: userEmail, // Store email as user identifier
          customer_name: booking.customer_name,
          service: booking.service,
          appointment_time: booking.appointment_time,
          duration_minutes: 60, // Default duration
          confidence: booking.confidence,
          raw_email: message, // Store SMS in raw_email field (rename later)
          synced: false, // Will sync to calendar next
          sync_method: 'ios_sms',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (bookingError) {
        console.error('❌ Error saving booking:', bookingError);
        return NextResponse.json(
          { error: 'Failed to save booking' },
          { status: 500 }
        );
      }

      savedBooking = data;
    }

    // TODO: Trigger calendar sync via MCP server
    // For now, just log success
    console.log('✅ Booking saved:', savedBooking);

    return NextResponse.json({
      success: true,
      booking: {
        id: savedBooking.id,
        customer: booking.customer_name,
        service: booking.service,
        time: booking.appointment_time,
      },
      message: 'Booking received and saved successfully',
    });

  } catch (error: any) {
    console.error('❌ SMS webhook error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * Parse StyleSeat booking SMS into structured data
 * Example formats:
 * - "New booking: Sarah Johnson - Haircut - Jan 15, 2026 at 2:00pm"
 * - "You just got booked! John Doe scheduled a Color on January 20th at 10:00 AM"
 * - "Appointment confirmed: Maria Garcia - Highlights - 01/25/2026 3:30 PM"
 */
function parseStyleSeatSMS(message: string): ParsedBooking | null {
  try {
    // Common patterns in booking SMS
    // Real StyleSeat format: "StyleSeat: You just got booked! [Name] scheduled a [Service] with you on [Date] at [Time]."
    const patterns = {
      // Customer name patterns
      customer1: /booked!\s+([A-Za-z][A-Za-z\-]+(?:\s+[A-Za-z][A-Za-z\-]+)+?)\s+scheduled/i, // "booked! Name Name scheduled"
      customer2: /(?:booking:|booked!)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+?)(?=\s+(?:scheduled|for|-))/i,
      customer3: /(?:confirmed:|from:)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+?)(?=\s+(?:for|-))/i,
      customer4: /-\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+?)\s*-/,

      // Service patterns
      service1: /scheduled\s+a\s+(.+?)\s+with\s+you\s+on/i, // "scheduled a [Service] with you on"
      service2: /scheduled\s+(?:a\s+)?(.+?)\s+on/i,
      service3: /-\s*([^-]+?)\s*-/,
      service4: /for\s+(?:a\s+)?(.+?)\s+on/i,

      // Date patterns - "on Jan 16" or "on January 24"
      date1: /with\s+you\s+on\s+([A-Z][a-z]+\s+\d{1,2})/i, // "with you on Jan 16"
      date2: /on\s+([A-Z][a-z]+\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?)/i,
      date3: /(\d{1,2}\/\d{1,2}\/\d{4})/,
      date4: /([A-Z][a-z]+\s+\d{1,2}(?:,\s+\d{4})?)/i,

      // Time patterns - "at 01:45 pm" or "at 10:00 am"
      time1: /at\s+(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/i,
      time2: /(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/i,
    };

    let customer_name = '';
    let service = '';
    let dateStr = '';
    let timeStr = '';
    let confidence = 0;

    // Try to extract customer name
    for (const [key, pattern] of Object.entries(patterns)) {
      if (key.startsWith('customer')) {
        const match = message.match(pattern);
        if (match) {
          customer_name = match[1].trim();
          confidence += 0.3;
          break;
        }
      }
    }

    // Try to extract service
    for (const [key, pattern] of Object.entries(patterns)) {
      if (key.startsWith('service')) {
        const match = message.match(pattern);
        if (match) {
          service = match[1].trim();
          confidence += 0.3;
          break;
        }
      }
    }

    // Try to extract date
    for (const [key, pattern] of Object.entries(patterns)) {
      if (key.startsWith('date')) {
        const match = message.match(pattern);
        if (match) {
          dateStr = match[1].trim();
          confidence += 0.2;
          break;
        }
      }
    }

    // Try to extract time
    for (const [key, pattern] of Object.entries(patterns)) {
      if (key.startsWith('time')) {
        const match = message.match(pattern);
        if (match) {
          timeStr = match[1].trim();
          confidence += 0.2;
          break;
        }
      }
    }

    // Log what we extracted
    console.log('🔍 Parsed fields:', {
      customer_name,
      service,
      dateStr,
      timeStr,
      confidence
    });

    // Must have at least customer and time to be valid
    if (!customer_name || !timeStr) {
      console.log('❌ Missing required fields:', {
        customer_name,
        service,
        dateStr,
        timeStr
      });
      return null;
    }

    // Combine date and time
    const appointmentTimeStr = dateStr
      ? `${dateStr} ${timeStr}`
      : timeStr;

    // Parse to ISO format with better handling
    let appointmentDate: Date;

    // Try different parsing approaches
    if (dateStr && timeStr) {
      // Parse date and time separately for better reliability
      const cleanTimeStr = timeStr.replace(/\s+/g, '').toLowerCase();
      const isPM = cleanTimeStr.includes('pm');
      const isAM = cleanTimeStr.includes('am');

      // Extract hour and minute
      const timeMatch = cleanTimeStr.match(/(\d{1,2}):(\d{2})/);
      if (!timeMatch) {
        console.error('❌ Invalid time format:', timeStr);
        return null;
      }

      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);

      // Convert to 24-hour format
      if (isPM && hours !== 12) hours += 12;
      if (isAM && hours === 12) hours = 0;

      // Check if date is in slash format (MM/DD/YYYY)
      const slashMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (slashMatch) {
        const [, month, day, year] = slashMatch;
        appointmentDate = new Date(
          parseInt(year),
          parseInt(month) - 1,  // Months are 0-indexed
          parseInt(day),
          hours,
          minutes
        );

        if (isNaN(appointmentDate.getTime())) {
          console.error('❌ Invalid date/time from slash format:', dateStr, timeStr);
          return null;
        }

        return {
          customer_name,
          service: service || 'Unknown Service',
          appointment_time: appointmentDate.toISOString(),
          confidence,
        };
      }

      // Parse date string - handle with or without year
      let dateMatch = dateStr.match(/([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/);
      let year: string;
      let monthStr: string;
      let day: string;

      if (dateMatch) {
        // Format with year: "Jan 15, 2026" or "January 20th, 2026"
        [, monthStr, day, year] = dateMatch;
      } else {
        // Format without year: "January 20th" or "Jan 15"
        const noYearMatch = dateStr.match(/([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?/);
        if (!noYearMatch) {
          console.error('❌ Invalid date format:', dateStr);
          return null;
        }
        [, monthStr, day] = noYearMatch;
        // Assume current year or next year if date has passed
        const now = new Date();
        const currentYear = now.getFullYear();
        year = currentYear.toString();
      }

      const monthMap: { [key: string]: number } = {
        jan: 0, january: 0,
        feb: 1, february: 1,
        mar: 2, march: 2,
        apr: 3, april: 3,
        may: 4,
        jun: 5, june: 5,
        jul: 6, july: 6,
        aug: 7, august: 7,
        sep: 8, september: 8,
        oct: 9, october: 9,
        nov: 10, november: 10,
        dec: 11, december: 11
      };

      const month = monthMap[monthStr.toLowerCase()];
      if (month === undefined) {
        console.error('❌ Invalid month:', monthStr);
        return null;
      }

      appointmentDate = new Date(parseInt(year), month, parseInt(day), hours, minutes);

      // If date is in the past and we assumed current year, use next year
      if (!dateMatch) {
        const now = new Date();
        if (appointmentDate < now) {
          appointmentDate = new Date(parseInt(year) + 1, month, parseInt(day), hours, minutes);
        }
      }
    } else {
      // Fallback to simple parsing
      appointmentDate = new Date(appointmentTimeStr);
    }

    if (isNaN(appointmentDate.getTime())) {
      console.error('❌ Invalid date/time:', appointmentTimeStr);
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
    message: 'StyleSync iOS SMS Webhook Endpoint',
    status: 'active',
    usage: 'POST to this endpoint with SMS data from iOS Shortcuts',
    userId: userId || 'not provided',
  });
}
