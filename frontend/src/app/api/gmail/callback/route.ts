import { NextRequest, NextResponse } from 'next/server';

const FRONTEND_URL = 'https://khonkaen-pos.vercel.app';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${FRONTEND_URL}/settings/gmail?error=missing_code`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  const backendUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  const secret = process.env.GMAIL_CALLBACK_SECRET;

  if (!clientId || !clientSecret || !redirectUri || !secret) {
    console.error('Gmail callback: missing required env vars');
    return NextResponse.redirect(`${FRONTEND_URL}/settings/gmail?error=exchange_failed`);
  }

  try {
    // Exchange code for tokens directly from Vercel (bypasses Render outbound HTTPS restriction)
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Gmail callback: token exchange failed', errorText);
      return NextResponse.redirect(`${FRONTEND_URL}/settings/gmail?error=exchange_failed`);
    }

    const tokens = await tokenResponse.json() as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      token_type?: string;
    };

    if (!tokens.access_token || !tokens.refresh_token) {
      console.error('Gmail callback: missing access_token or refresh_token in response');
      return NextResponse.redirect(`${FRONTEND_URL}/settings/gmail?error=exchange_failed`);
    }

    // Get email address from Google userinfo
    const userinfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    let email = '';
    if (userinfoResponse.ok) {
      const userinfo = await userinfoResponse.json() as { email?: string };
      email = userinfo.email ?? '';
    }

    const expiryDate = tokens.expires_in
      ? Date.now() + tokens.expires_in * 1000
      : Date.now() + 3600 * 1000;

    // Forward tokens to backend for storage
    const storeResponse = await fetch(`${backendUrl}/api/v1/gmail-shipping/store-tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        email,
        expiryDate,
      }),
    });

    if (!storeResponse.ok) {
      const errorText = await storeResponse.text();
      console.error('Gmail callback: store-tokens failed', errorText);
      return NextResponse.redirect(`${FRONTEND_URL}/settings/gmail?error=exchange_failed`);
    }

    return NextResponse.redirect(`${FRONTEND_URL}/settings/gmail?callback=true`);
  } catch (err) {
    console.error('Gmail callback: unexpected error', err instanceof Error ? err.message : String(err));
    return NextResponse.redirect(`${FRONTEND_URL}/settings/gmail?error=exchange_failed`);
  }
}
