/**
 * Debug endpoint to check user token status
 * GET /api/check-tokens?email=user@example.com
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('email');

  if (!email) {
    return NextResponse.json({ error: 'Missing email parameter' }, { status: 400 });
  }

  const { data: user, error } = await supabase
    .from('user_tokens')
    .select('user_id, user_email, access_token, refresh_token, auth_method, created_at, updated_at')
    .eq('user_email', email)
    .single();

  if (error || !user) {
    return NextResponse.json({ error: 'User not found', details: error }, { status: 404 });
  }

  // Check if tokens are placeholder or encrypted
  const isPlaceholder = user.access_token === 'pending_ios_oauth';
  const isEncrypted = user.access_token?.includes(':'); // Encrypted tokens have format iv:authTag:ciphertext

  return NextResponse.json({
    user_email: user.user_email,
    auth_method: user.auth_method,
    token_status: isPlaceholder ? 'PLACEHOLDER' : (isEncrypted ? 'ENCRYPTED' : 'UNKNOWN'),
    access_token_preview: user.access_token?.substring(0, 30) + '...',
    refresh_token_preview: user.refresh_token?.substring(0, 30) + '...',
    created_at: user.created_at,
    updated_at: user.updated_at,
  });
}
