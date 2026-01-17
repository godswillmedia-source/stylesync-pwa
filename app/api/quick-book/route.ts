/**
 * Quick Book API
 *
 * POST /api/quick-book
 * Creates a booking from the iOS app Quick Book feature
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_email, client_name, service, date_time, notes } = body;

    if (!user_email || !client_name || !service || !date_time) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: user_email, client_name, service, date_time' },
        { status: 400 }
      );
    }

    // Create the booking in the 'bookings' table (same as dashboard uses)
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        user_email: user_email,
        client_name: client_name,
        service: service,
        booking_date: date_time,
        duration: 60,
        notes: notes || null,
        created_at: new Date().toISOString(),
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

    // TODO: Sync to Google Calendar if user has calendar connected

    return NextResponse.json({
      success: true,
      booking_id: booking.id,
      message: `Booking created for ${client_name}`,
    });

  } catch (error) {
    console.error('Quick book error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create booking' },
      { status: 500 }
    );
  }
}
