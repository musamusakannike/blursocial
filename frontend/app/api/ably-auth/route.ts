import { NextRequest } from 'next/server';
import Ably from 'ably';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return new Response(JSON.stringify({ error: 'clientId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey = process.env.ABLY_API_KEY;
    if (!apiKey) {
      console.warn('Warning: ABLY_API_KEY environment variable is not set.');
      return new Response(
        JSON.stringify({ error: 'Ably API key not configured on server' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Instantiate Ably Rest client using the API key
    const client = new Ably.Rest({ key: apiKey });

    // Generate token request scoped only to room and notification channels
    const tokenRequest = await client.auth.createTokenRequest({
      clientId,
      capability: {
        'room:*': ['subscribe', 'publish', 'presence'],
        [`notifications:${clientId}`]: ['subscribe', 'publish'],
      },
    });

    return new Response(JSON.stringify(tokenRequest), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Ably auth error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
