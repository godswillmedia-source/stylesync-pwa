/**
 * Quick Book API
 *
 * POST /api/quick-book
 * Creates a booking from the iOS app Quick Book feature
 * Also syncs to Google Calendar if user has valid tokens
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { CalendarService } from '@/app/lib/calendar';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_email, client_name, service, date_time } = body;

    if (!user_email || !client_name || !service || !date_time) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: user_email, client_name, service, date_time' },
        { status: 400 }
      );
    }

    // Get user with tokens
    const { data: user, error: userError } = await supabase
      .from('user_tokens')
      .select('user_id, access_token, refresh_token, auth_method')
      .eq('user_email', user_email)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'User not found. Please sign in first.' },
        { status: 404 }
      );
    }

    // Create the booking in salon_bookings table
    const { data: booking, error: bookingError } = await supabase
      .from('salon_bookings')
      .insert({
        user_id: user.user_id,
        customer_name: client_name,
        service: service,
        appointment_time: date_time,
        duration_minutes: 60,
        is_synced: false,
      })
      .select()
      .single();

    if (bookingError) {
      console.error('Booking error:', bookingError);
      return NextResponse.json(
        { success: false, error: bookingError.message },
        { status: 500 }
      );
    }

    // Sync to Google Calendar if user has valid tokens
    let calendarSynced = false;
    let googleEventId: string | null = null;

    const hasValidTokens = user.access_token &&
                           user.access_token !== 'pending_ios_oauth' &&
                           user.refresh_token &&
                           user.refresh_token !== 'pending_ios_oauth';

    if (hasValidTokens) {
      try {
        const calendarService = new CalendarService({
          accessToken: user.access_token,
          refreshToken: user.refresh_token,
          authMethod: user.auth_method || 'web',
          onTokenRefresh: async (tokens) => {
            // Update tokens in database when refreshed
            await supabase
              .from('user_tokens')
              .update({
                access_token: tokens.accessToken,
                refresh_token: tokens.refreshToken || user.refresh_token,
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', user.user_id);
          },
        });

        // Calculate end time (1 hour from start)
        const endTime = CalendarService.calculateEndTime(date_time, 60);

        // Create calendar event
        const event = await calendarService.createEvent({
          summary: `${service} - ${client_name}`,
          description: `StyleSync booking\nService: ${service}\nClient: ${client_name}`,
          start: {
            dateTime: date_time,
            timeZone: 'America/New_York',
          },
          end: {
            dateTime: endTime,
            timeZone: 'America/New_York',
          },
        });

        googleEventId = event.eventId;
        calendarSynced = true;

        // Update booking with calendar event ID
        await supabase
          .from('salon_bookings')
          .update({
            google_event_id: googleEventId,
            is_synced: true,
          })
          .eq('id', booking.id);

        console.log('✅ Calendar event created:', googleEventId);
      } catch (calError) {
        console.error('Calendar sync failed (booking still created):', calError);
        // Don't fail the whole request - booking was created successfully
      }
    }

    return NextResponse.json({
      success: true,
      booking_id: booking.id,
      message: `Booking created for ${client_name}`,
      calendar_synced: calendarSynced,
      google_event_id: googleEventId,
    });

  } catch (error) {
    console.error('Quick book error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create booking' },
      { status: 500 }
    );
  }
}
