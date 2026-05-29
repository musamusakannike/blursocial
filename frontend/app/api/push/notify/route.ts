import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function POST(request: NextRequest) {
  try {
    const { title, body, roomSlug, excludeUserId } = await request.json();

    if (!title || !body) {
      return NextResponse.json({ error: 'Title and body are required' }, { status: 400 });
    }

    const db = await getDb();

    // Get all push tokens (optionally exclude sender)
    const filter: Record<string, any> = {};
    if (excludeUserId) {
      filter.userId = { $ne: excludeUserId };
    }

    const tokens = await db.collection('push_tokens').find(filter).toArray();

    if (tokens.length === 0) {
      return NextResponse.json({ success: true, sent: 0 });
    }

    // Send via Expo push notification service
    const messages = tokens.map((t) => ({
      to: t.token,
      sound: 'default',
      title,
      body,
      data: { roomSlug: roomSlug || null },
    }));

    // Batch send (Expo allows up to 100 per request)
    const chunks = [];
    for (let i = 0; i < messages.length; i += 100) {
      chunks.push(messages.slice(i, i + 100));
    }

    let totalSent = 0;
    for (const chunk of chunks) {
      try {
        const res = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chunk),
        });
        if (res.ok) {
          totalSent += chunk.length;
        }
      } catch (e) {
        console.error('Push send error:', e);
      }
    }

    return NextResponse.json({ success: true, sent: totalSent });
  } catch (error) {
    console.error('Push notify error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
