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

    // Get user_id from email
    const { data: user, error: userError } = await supabase
      .from('user_tokens')
      .select('user_id')
      .eq('email', user_email)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Create the booking
    const { data: booking, error: bookingError } = await supabase
      .from('salon_bookings')
      .insert({
        user_id: user.user_id,
        customer_name: client_name,
        service: service,
        appointment_time: date_time,
        duration_minutes: 60,
        notes: notes || null,
        status: 'confirmed',
        created_via: 'quick_book',
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
    // This would call the calendar sync service

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
