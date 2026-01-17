/**
 * Simple User Registration
 *
 * POST /api/auth/register
 * Creates a user record for iOS app users who signed in with Google
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email required' },
        { status: 400 }
      );
    }

    // Check if user exists
    const { data: existing } = await supabase
      .from('user_tokens')
      .select('user_id')
      .eq('user_email', email)
      .single();

    if (existing) {
      return NextResponse.json({
        success: true,
        message: 'User already exists',
        user_id: existing.user_id,
      });
    }

    // Create new user
    const userId = uuidv4();

    const { error } = await supabase
      .from('user_tokens')
      .insert({
        user_id: userId,
        user_email: email,
        auth_method: 'ios',
        access_token: 'pending_ios_oauth',  // Placeholder until calendar connected
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Registration error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'User registered',
      user_id: userId,
    });

  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { success: false, error: 'Registration failed' },
      { status: 500 }
    );
  }
}
