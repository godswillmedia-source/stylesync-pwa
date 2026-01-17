import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Messages API
 * Fetches raw messages with stats for the StyleSeatMap component
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function GET(req: NextRequest) {
  try {
    const userEmail = req.nextUrl.searchParams.get('user');
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50');

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

    // Fetch messages
    const { data: messages, error: msgError } = await supabase
      .from('raw_messages')
      .select('id, raw_content, sender, message_type, ai_confidence, action_taken, processed, created_at')
      .eq('user_id', user.user_id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (msgError) {
      throw msgError;
    }

    // Calculate stats
    const total = messages?.length || 0;
    const processed = messages?.filter(m => m.processed).length || 0;
    const pending = total - processed;

    // Count by type
    const byType: Record<string, number> = {};
    messages?.forEach(m => {
      if (m.message_type) {
        byType[m.message_type] = (byType[m.message_type] || 0) + 1;
      }
    });

    return NextResponse.json({
      messages: messages || [],
      stats: {
        total,
        processed,
        pending,
        byType,
      },
    });

  } catch (error: any) {
    console.error('Messages API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
