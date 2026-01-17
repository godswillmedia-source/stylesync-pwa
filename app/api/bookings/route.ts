import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Bookings API
 *
 * GET - Fetch user's bookings
 * POST - Add a new booking (called by SMS webhook after parsing)
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// GET /api/bookings?email=user@example.com
export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Missing email parameter' },
        { status: 400 }
      );
    }

    // Get user_id from email
    const { data: user } = await supabase
      .from('user_tokens')
      .select('user_id')
      .eq('user_email', email)
      .single();

    if (!user) {
      return NextResponse.json([]);  // No user = no bookings
    }

    const { data: bookings, error } = await supabase
      .from('salon_bookings')
      .select('*')
      .eq('user_id', user.user_id)
      .order('appointment_time', { ascending: true });

    if (error) {
      console.error('Error fetching bookings:', error);
      return NextResponse.json(
        { error: 'Failed to fetch bookings' },
        { status: 500 }
      );
    }

    // Return snake_case format (iOS app expects this)
    const formattedBookings = (bookings || []).map((b) => ({
      id: b.id,
      customer_name: b.customer_name,
      service: b.service,
      appointment_time: b.appointment_time,
      duration_minutes: b.duration_minutes || 60,
      raw_email: null,
      created_at: b.created_at,
    }));

    return NextResponse.json(formattedBookings);

  } catch (error: any) {
    console.error('Bookings GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/bookings
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      user_email,
      client_name,
      service,
      booking_date,
      duration,
      notes,
      raw_message,
    } = body;

    if (!user_email || !client_name || !booking_date) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check for duplicate (same user, client, date within 1 hour)
    const bookingTime = new Date(booking_date);
    const hourBefore = new Date(bookingTime.getTime() - 60 * 60 * 1000);
    const hourAfter = new Date(bookingTime.getTime() + 60 * 60 * 1000);

    const { data: existing } = await supabase
      .from('bookings')
      .select('id')
      .eq('user_email', user_email)
      .eq('client_name', client_name)
      .gte('booking_date', hourBefore.toISOString())
      .lte('booking_date', hourAfter.toISOString())
      .single();

    if (existing) {
      console.log('Duplicate booking detected, skipping');
      return NextResponse.json({
        message: 'Duplicate booking, skipped',
        duplicate: true,
        existingId: existing.id,
      });
    }

    // Insert new booking
    const { data: newBooking, error } = await supabase
      .from('bookings')
      .insert({
        user_email,
        client_name,
        service: service || 'Appointment',
        booking_date,
        duration: duration || 60,
        notes,
        raw_message,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating booking:', error);
      return NextResponse.json(
        { error: 'Failed to create booking' },
        { status: 500 }
      );
    }

    console.log('✅ New booking created:', newBooking.id);

    return NextResponse.json({
      message: 'Booking created',
      booking: {
        id: newBooking.id,
        clientName: newBooking.client_name,
        service: newBooking.service,
        date: newBooking.booking_date,
        duration: newBooking.duration,
      },
    });

  } catch (error: any) {
    console.error('Bookings POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
