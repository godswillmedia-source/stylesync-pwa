import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Diana AI Endpoint
 *
 * Diana is the AI booking assistant. She can answer questions
 * about the user's bookings using the context provided.
 *
 * For now, this uses simple pattern matching.
 * Later, you can integrate OpenAI/Claude for smarter responses.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function POST(req: NextRequest) {
  try {
    const { query, email, context } = await req.json();

    if (!query || !email) {
      return NextResponse.json(
        { error: 'Missing query or email' },
        { status: 400 }
      );
    }

    // Fetch user's bookings from database
    // First get user_id from user_tokens
    const { data: userToken } = await supabase
      .from('user_tokens')
      .select('user_id')
      .eq('user_email', email)
      .single();

    const { data: bookings, error } = await supabase
      .from('salon_bookings')
      .select('*')
      .eq('user_id', userToken?.user_id || email)
      .gte('appointment_time', new Date().toISOString())
      .order('appointment_time', { ascending: true })
      .limit(20);

    if (error) {
      console.error('Error fetching bookings:', error);
    }

    // Generate Diana's response
    const response = generateDianaResponse(query, bookings || [], context);

    return NextResponse.json({ message: response });

  } catch (error: any) {
    console.error('Diana error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function generateDianaResponse(
  query: string,
  bookings: any[],
  context: string
): string {
  const lowerQuery = query.toLowerCase();

  // Today's bookings
  if (lowerQuery.includes('today')) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayBookings = bookings.filter((b) => {
      const bookingDate = new Date(b.appointment_time);
      return bookingDate >= today && bookingDate < tomorrow;
    });

    if (todayBookings.length === 0) {
      return "You don't have any bookings scheduled for today. Enjoy your free time! 🎉";
    }

    let response = `You have ${todayBookings.length} booking(s) today:\n\n`;
    todayBookings.forEach((b) => {
      const time = new Date(b.appointment_time).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      response += `• ${b.customer_name} - ${b.service} at ${time}\n`;
    });
    return response;
  }

  // Tomorrow's bookings
  if (lowerQuery.includes('tomorrow')) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const tomorrowBookings = bookings.filter((b) => {
      const bookingDate = new Date(b.appointment_time);
      return bookingDate >= tomorrow && bookingDate < dayAfter;
    });

    if (tomorrowBookings.length === 0) {
      return "You don't have any bookings scheduled for tomorrow.";
    }

    let response = `You have ${tomorrowBookings.length} booking(s) tomorrow:\n\n`;
    tomorrowBookings.forEach((b) => {
      const time = new Date(b.appointment_time).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      response += `• ${b.customer_name} - ${b.service} at ${time}\n`;
    });
    return response;
  }

  // This week
  if (lowerQuery.includes('week') || lowerQuery.includes('upcoming')) {
    if (bookings.length === 0) {
      return "You don't have any upcoming bookings scheduled.";
    }

    const upcomingBookings = bookings.slice(0, 7);
    let response = `Your upcoming bookings:\n\n`;
    upcomingBookings.forEach((b) => {
      const date = new Date(b.appointment_time).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      const time = new Date(b.appointment_time).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      response += `• ${date} at ${time}\n  ${b.customer_name} - ${b.service}\n\n`;
    });
    return response;
  }

  // Count/summary
  if (lowerQuery.includes('how many') || lowerQuery.includes('count') || lowerQuery.includes('summary')) {
    const now = new Date();
    const weekFromNow = new Date(now);
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    const monthFromNow = new Date(now);
    monthFromNow.setMonth(monthFromNow.getMonth() + 1);

    const thisWeek = bookings.filter((b) => new Date(b.appointment_time) <= weekFromNow).length;
    const thisMonth = bookings.filter((b) => new Date(b.appointment_time) <= monthFromNow).length;

    return `Here's your booking summary:\n\n• This week: ${thisWeek} booking(s)\n• This month: ${thisMonth} booking(s)\n• Total upcoming: ${bookings.length} booking(s)`;
  }

  // Search for client name
  const words = lowerQuery.split(' ');
  for (const word of words) {
    if (word.length > 2) {
      const matchingBookings = bookings.filter((b) =>
        b.customer_name?.toLowerCase().includes(word)
      );
      if (matchingBookings.length > 0) {
        let response = `Found ${matchingBookings.length} booking(s) for "${word}":\n\n`;
        matchingBookings.forEach((b) => {
          const date = new Date(b.appointment_time).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          });
          const time = new Date(b.appointment_time).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          });
          response += `• ${date} at ${time} - ${b.service}\n`;
        });
        return response;
      }
    }
  }

  // Default response
  return `I can help you with questions like:

• "What do I have today?"
• "Show me tomorrow's bookings"
• "What's my schedule this week?"
• "How many bookings do I have?"
• "Find bookings for [client name]"

Feel free to ask!`;
}

export async function GET() {
  return NextResponse.json({
    message: 'Diana AI Endpoint',
    status: 'active',
    usage: 'POST with { query, email, context }',
  });
}
