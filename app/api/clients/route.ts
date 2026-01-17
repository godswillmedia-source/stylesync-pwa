import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Clients API
 * Fetches client data for the ClientList component
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function GET(req: NextRequest) {
  try {
    const userEmail = req.nextUrl.searchParams.get('user');

    if (!userEmail) {
      return NextResponse.json({ error: 'Missing user parameter' }, { status: 400 });
    }

    // Get user_id from email
    const { data: user, error: userError } = await supabase
      .from('user_tokens')
      .select('user_id')
      .eq('user_email', userEmail)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch clients
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('id, canonical_name, aliases, booking_count, cancellation_count, no_show_count, total_spend, first_seen, last_seen')
      .eq('user_id', user.user_id)
      .order('last_seen', { ascending: false });

    if (clientError) {
      throw clientError;
    }

    return NextResponse.json({
      clients: clients || [],
    });

  } catch (error: any) {
    console.error('Clients API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
