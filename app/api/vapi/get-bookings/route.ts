/**
 * VAPI Webhook: Get Bookings
 *
 * Called by Diana (VAPI assistant) to fetch bookings for a user.
 * VAPI sends the user's email via metadata.userEmail
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

    // VAPI sends function call parameters in message.functionCall.parameters
    // and metadata in message.call.metadata
    const functionCall = body.message?.functionCall;
    const metadata = body.message?.call?.metadata || body.message?.metadata || {};

    const userEmail = metadata.userEmail || metadata.user_email;
    const params = functionCall?.parameters || {};

    console.log('VAPI get_bookings called:', { userEmail, params });

    if (!userEmail) {
      return NextResponse.json({
        result: "I couldn't identify your account. Please make sure you're logged in."
      });
    }

    // Get user_id from email
    const { data: user } = await supabase
      .from('user_tokens')
      .select('user_id')
      .eq('user_email', userEmail)
      .single();

    if (!user) {
      return NextResponse.json({
        result: "I couldn't find your account. Please sign in first."
      });
    }

    // Build query based on parameters
    let query = supabase
      .from('salon_bookings')
      .select('*')
      .eq('user_id', user.user_id)
      .order('appointment_time', { ascending: true });

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
    const nextWeekStart = new Date(today);
    nextWeekStart.setDate(nextWeekStart.getDate() + 7);
    const nextWeekEnd = new Date(nextWeekStart);
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);
    const thisWeekEnd = new Date(today);
    thisWeekEnd.setDate(thisWeekEnd.getDate() + (7 - today.getDay()));

    // Apply time range filter
    const timeRange = params.time_range || 'upcoming';

    if (params.date) {
      // Specific date
      const targetDate = new Date(params.date);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      query = query.gte('appointment_time', targetDate.toISOString())
                   .lt('appointment_time', nextDay.toISOString());
    } else {
      switch (timeRange) {
        case 'today':
          query = query.gte('appointment_time', today.toISOString())
                       .lt('appointment_time', tomorrow.toISOString());
          break;
        case 'tomorrow':
          query = query.gte('appointment_time', tomorrow.toISOString())
                       .lt('appointment_time', dayAfterTomorrow.toISOString());
          break;
        case 'this_week':
          query = query.gte('appointment_time', today.toISOString())
                       .lt('appointment_time', thisWeekEnd.toISOString());
          break;
        case 'next_week':
          query = query.gte('appointment_time', nextWeekStart.toISOString())
                       .lt('appointment_time', nextWeekEnd.toISOString());
          break;
        case 'upcoming':
        default:
          query = query.gte('appointment_time', now.toISOString())
                       .limit(10);
          break;
      }
    }

    // Filter by client name if provided
    if (params.client_name) {
      query = query.ilike('customer_name', `%${params.client_name}%`);
    }

    const { data: bookings, error } = await query;

    if (error) {
      console.error('Error fetching bookings:', error);
      return NextResponse.json({
        result: "Sorry, I had trouble fetching your bookings. Please try again."
      });
    }

    if (!bookings || bookings.length === 0) {
      const rangeText = timeRange === 'today' ? 'today' :
                        timeRange === 'tomorrow' ? 'tomorrow' :
                        timeRange === 'this_week' ? 'this week' :
                        timeRange === 'next_week' ? 'next week' :
                        'upcoming';
      return NextResponse.json({
        result: `You don't have any bookings ${rangeText}.`
      });
    }

    // Format bookings for Diana to speak
    const formattedBookings = bookings.map(b => {
      const date = new Date(b.appointment_time);
      const timeStr = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      const dateStr = date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
      return `${b.customer_name} for ${b.service} on ${dateStr} at ${timeStr}`;
    });

    const result = bookings.length === 1
      ? `You have 1 booking: ${formattedBookings[0]}.`
      : `You have ${bookings.length} bookings: ${formattedBookings.join('; ')}.`;

    return NextResponse.json({
      result,
      bookings: bookings.map(b => ({
        id: b.id,
        google_event_id: b.google_event_id,
        customer_name: b.customer_name,
        service: b.service,
        appointment_time: b.appointment_time,
        duration_minutes: b.duration_minutes
      }))
    });

  } catch (error) {
    console.error('VAPI get_bookings error:', error);
    return NextResponse.json({
      result: "Sorry, something went wrong. Please try again."
    });
  }
}

// Also support GET for testing
export async function GET() {
  return NextResponse.json({
    endpoint: 'VAPI Get Bookings',
    status: 'active',
    usage: 'POST with VAPI webhook payload'
  });
}
