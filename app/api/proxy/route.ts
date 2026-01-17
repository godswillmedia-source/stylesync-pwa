import { NextRequest, NextResponse } from 'next/server';

// Proxy endpoint that adds the session token from httpOnly cookie
// to requests to the agent backend

export async function GET(request: NextRequest) {
  return handleProxy(request, 'GET');
}

export async function POST(request: NextRequest) {
  return handleProxy(request, 'POST');
}

async function handleProxy(request: NextRequest, method: string) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const agentUrl = process.env.NEXT_PUBLIC_AGENT_URL;
    if (!agentUrl) {
      return NextResponse.json({ error: 'Agent URL not configured' }, { status: 500 });
    }

    // Get the action from query params
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (!action) {
      return NextResponse.json({ error: 'Missing action parameter' }, { status: 400 });
    }

    // Build target URL
    const targetUrl = `${agentUrl}?action=${action}`;

    // Prepare fetch options
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
    };

    // Add body for POST requests
    if (method === 'POST') {
      try {
        const body = await request.json();
        fetchOptions.body = JSON.stringify(body);
      } catch {
        // No body or invalid JSON - that's fine for some POSTs
      }
    }

    // Forward request to agent
    const agentResponse = await fetch(targetUrl, fetchOptions);
    const data = await agentResponse.json().catch(() => ({}));

    return NextResponse.json(data, { status: agentResponse.status });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Proxy request failed' },
      { status: 500 }
    );
  }
}
