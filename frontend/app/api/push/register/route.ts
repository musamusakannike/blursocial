import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { pushToken, platform } = await request.json();

    if (!pushToken || typeof pushToken !== 'string') {
      return NextResponse.json({ error: 'Push token is required' }, { status: 400 });
    }

    const db = await getDb();

    // Upsert push token for user
    await db.collection('push_tokens').updateOne(
      { userId: user._id, token: pushToken },
      {
        $set: {
          userId: user._id,
          username: user.username,
          token: pushToken,
          platform: platform || 'unknown',
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Push register error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
