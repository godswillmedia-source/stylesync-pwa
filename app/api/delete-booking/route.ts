/**
 * Delete Booking API
 * DELETE /api/delete-booking
 * Deletes a booking from the database and Google Calendar
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { getEncryptionService } from '@/app/lib/encryption';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { booking_id, user_email } = body;

    if (!booking_id || !user_email) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: booking_id, user_email' },
        { status: 400 }
      );
    }

    // Get the booking to find the google_event_id
    const { data: booking, error: bookingError } = await supabase
      .from('salon_bookings')
      .select('id, google_event_id, user_id')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      );
    }

    // If there's a Google Calendar event, delete it
    let calendarDeleted = false;
    if (booking.google_event_id) {
      try {
        // Get user tokens
        const { data: user } = await supabase
          .from('user_tokens')
          .select('access_token, refresh_token')
          .eq('user_email', user_email)
          .single();

        if (user && user.access_token) {
          const encryptionService = getEncryptionService();
          const accessToken = encryptionService.decrypt(user.access_token);
          const refreshToken = user.refresh_token 
            ? encryptionService.decrypt(user.refresh_token) 
            : undefined;

          const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
          );

          oauth2Client.setCredentials({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

          await calendar.events.delete({
            calendarId: 'primary',
            eventId: booking.google_event_id
          });

          calendarDeleted = true;
          console.log('✅ Deleted Google Calendar event:', booking.google_event_id);
        }
      } catch (calError: any) {
        console.error('Failed to delete calendar event:', calError.message);
        // Continue with database deletion even if calendar delete fails
      }
    }

    // Delete the booking from database
    const { error: deleteError } = await supabase
      .from('salon_bookings')
      .delete()
      .eq('id', booking_id);

    if (deleteError) {
      return NextResponse.json(
        { success: false, error: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Booking deleted successfully',
      calendar_deleted: calendarDeleted
    });

  } catch (error: any) {
    console.error('Delete booking error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete booking' },
      { status: 500 }
    );
  }
}
