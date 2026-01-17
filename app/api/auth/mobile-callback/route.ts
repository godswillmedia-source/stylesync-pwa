import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEncryptionService } from '@/app/lib/encryption';

/**
 * Mobile OAuth Callback Endpoint
 *
 * This endpoint handles the OAuth token exchange for the iOS app.
 * The iOS app sends an authorization code, and we exchange it for
 * access/refresh tokens, then store them in the database.
 *
 * Flow:
 * 1. iOS app opens Google sign-in in Safari
 * 2. User grants permission
 * 3. Google redirects to iOS app with auth code
 * 4. iOS app POSTs the code here
 * 5. We exchange code for tokens with Google
 * 6. We store encrypted tokens in database
 * 7. We return user info to the iOS app
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

// iOS Client ID - for mobile OAuth (no secret needed for iOS/Android)
const GOOGLE_IOS_CLIENT_ID = '93060139470-e7ruvtjjo8ntjoncsqhsj7f88n00r58l.apps.googleusercontent.com';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, redirect_uri } = body;

    if (!code) {
      return NextResponse.json(
        { error: 'Missing authorization code' },
        { status: 400 }
      );
    }

    console.log('📱 Mobile OAuth: Exchanging code for tokens...');

    // Determine if this is a mobile (iOS/Android) request
    const isMobileRedirect = redirect_uri && redirect_uri.includes(':/oauth2callback');

    // For mobile apps, use iOS client ID without secret
    // For web, use web client ID with secret
    const tokenParams: Record<string, string> = {
      code,
      client_id: isMobileRedirect ? GOOGLE_IOS_CLIENT_ID : GOOGLE_CLIENT_ID,
      redirect_uri: redirect_uri || 'com.godswill-stylesync.app:/oauth2callback',
      grant_type: 'authorization_code',
    };

    // Only include client_secret for web clients (mobile apps don't have one)
    if (!isMobileRedirect) {
      tokenParams.client_secret = GOOGLE_CLIENT_SECRET;
    }

    // Exchange authorization code for tokens with Google
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(tokenParams),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('❌ Token exchange failed:', errorData);
      return NextResponse.json(
        { error: 'Failed to exchange code for tokens', details: errorData },
        { status: 400 }
      );
    }

    const tokens = await tokenResponse.json();
    console.log('✅ Tokens received from Google');

    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      console.error('❌ Failed to get user info');
      return NextResponse.json(
        { error: 'Failed to get user info from Google' },
        { status: 400 }
      );
    }

    const userInfo = await userInfoResponse.json();
    console.log('✅ User info received:', userInfo.email);

    // Encrypt tokens before storing
    const encryptionService = getEncryptionService();
    const encryptedAccessToken = encryptionService.encrypt(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token
      ? encryptionService.encrypt(tokens.refresh_token)
      : null;

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('user_tokens')
      .select('user_id, user_email')
      .eq('user_email', userInfo.email)
      .single();

    let userId: string;

    if (existingUser) {
      // Update existing user's tokens
      userId = existingUser.user_id;

      const { error: updateError } = await supabase
        .from('user_tokens')
        .update({
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken || undefined,
          auth_method: isMobileRedirect ? 'ios' : 'web',
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error('❌ Failed to update tokens:', updateError);
        return NextResponse.json(
          { error: 'Failed to update user tokens' },
          { status: 500 }
        );
      }

      console.log('✅ Updated existing user tokens');
    } else {
      // Create new user
      // First, create entry in users table
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert({
          email: userInfo.email,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (userError) {
        // User might already exist in users table but not in user_tokens
        const { data: existingBaseUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', userInfo.email)
          .single();

        if (existingBaseUser) {
          userId = existingBaseUser.id;
        } else {
          console.error('❌ Failed to create user:', userError);
          return NextResponse.json(
            { error: 'Failed to create user' },
            { status: 500 }
          );
        }
      } else {
        userId = newUser.id;
      }

      // Create user_tokens entry
      const { error: tokenError } = await supabase
        .from('user_tokens')
        .insert({
          user_id: userId,
          user_email: userInfo.email,
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          auth_method: isMobileRedirect ? 'ios' : 'web',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (tokenError) {
        console.error('❌ Failed to store tokens:', tokenError);
        return NextResponse.json(
          { error: 'Failed to store user tokens' },
          { status: 500 }
        );
      }

      console.log('✅ Created new user and stored tokens');
    }

    // Check subscription status (you'd integrate with your payment system here)
    // For now, we'll return false and handle subscription separately in the app
    const isSubscribed = false;

    // Return success response to iOS app
    return NextResponse.json({
      access_token: tokens.access_token, // iOS app needs this for immediate use
      refresh_token: tokens.refresh_token,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      is_subscribed: isSubscribed,
    });

  } catch (error: any) {
    console.error('❌ Mobile OAuth error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// GET endpoint for testing
export async function GET() {
  return NextResponse.json({
    message: 'StyleSync Mobile OAuth Endpoint',
    status: 'active',
    usage: 'POST with { code, redirect_uri } to exchange OAuth code for tokens',
  });
}
