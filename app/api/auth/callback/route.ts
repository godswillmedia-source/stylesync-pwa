import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { code, redirect_uri } = await request.json();

    if (!code) {
      return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 });
    }

    // Exchange code for tokens via agent
    const agentUrl = process.env.NEXT_PUBLIC_AGENT_URL;
    if (!agentUrl) {
      return NextResponse.json({ error: 'Agent URL not configured' }, { status: 500 });
    }

    const agentResponse = await fetch(`${agentUrl}?action=register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        redirect_uri,
      }),
    });

    if (!agentResponse.ok) {
      const error = await agentResponse.json().catch(() => ({ error: 'Registration failed' }));
      return NextResponse.json(error, { status: agentResponse.status });
    }

    const { user_id, session_token, is_new_user, email } = await agentResponse.json();

    // Create response with session data
    const response = NextResponse.json({
      user_id,
      email,
      is_new_user,
    });

    // Set httpOnly cookie with session token
    const isProduction = process.env.NODE_ENV === 'production';

    response.cookies.set('session_token', session_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    // Set non-httpOnly cookies for user info (frontend needs these)
    response.cookies.set('user_email', email, {
      httpOnly: false,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    response.cookies.set('user_id', user_id, {
      httpOnly: false,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (error) {
    console.error('Auth callback error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
