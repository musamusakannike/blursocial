import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { Message, Room } from '@/lib/models/Room';
import { hashClientId, normalizeEmoji, summarizeReactions } from '@/lib/reactions';
import Ably from 'ably';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; messageId: string }> }
) {
  try {
    const { slug, messageId } = await params;
    const { emoji, action } = await request.json();
    const clientId = request.headers.get('x-client-id');

    if (!clientId) {
      return NextResponse.json(
        { error: 'Missing client identifier' },
        { status: 400 }
      );
    }

    const normalizedEmoji = normalizeEmoji(emoji);
    const clientHash = hashClientId(clientId);

    if (!normalizedEmoji) {
      return NextResponse.json(
        { error: 'Invalid emoji' },
        { status: 400 }
      );
    }

    if (action !== 'add' && action !== 'remove') {
      return NextResponse.json(
        { error: 'Invalid reaction action' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const room = await db.collection<Room>('rooms').findOne({ slug });

    if (!room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    if (!ObjectId.isValid(messageId)) {
      return NextResponse.json(
        { error: 'Invalid message id' },
        { status: 400 }
      );
    }

    const messagesCollection = db.collection<Message>('messages');
    const messageObjectId = new ObjectId(messageId);

    const message = await messagesCollection.findOne({
      _id: messageObjectId,
      roomId: room._id as ObjectId,
    });

    if (!message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    const reactionsMap: Record<string, string[]> = { ...(message.reactions ?? {}) };
    const existingUsers = new Set(reactionsMap[normalizedEmoji] ?? []);

    if (action === 'add') {
      existingUsers.add(clientHash);
      reactionsMap[normalizedEmoji] = Array.from(existingUsers);
    } else {
      existingUsers.delete(clientHash);
      if (existingUsers.size === 0) {
        delete reactionsMap[normalizedEmoji];
      } else {
        reactionsMap[normalizedEmoji] = Array.from(existingUsers);
      }
    }

    const updateResult = await messagesCollection.updateOne(
      { _id: messageObjectId, roomId: room._id as ObjectId },
      Object.keys(reactionsMap).length > 0
        ? { $set: { reactions: reactionsMap } }
        : { $unset: { reactions: '' } }
    );

    if (!updateResult.acknowledged) {
      return NextResponse.json(
        { error: 'Failed to update reactions' },
        { status: 500 }
      );
    }

    const updatedMessage = await messagesCollection.findOne({
      _id: messageObjectId,
      roomId: room._id as ObjectId,
    });

    const reactionSummary = summarizeReactions(
      updatedMessage?.reactions ?? {},
      clientHash
    );

    // Broadcast via Ably Rest
    const apiKey = process.env.ABLY_API_KEY;
    if (apiKey) {
      try {
        const ably = new Ably.Rest({ key: apiKey });
        await ably.channels.get(`room:${slug}`).publish('message-reactions-updated', {
          messageId,
          reactions: reactionSummary,
        });
      } catch (ablyError) {
        console.error('Ably reaction broadcast failed:', ablyError);
      }
    } else {
      console.warn('Warning: ABLY_API_KEY is not set. Real-time broadcast skipped.');
    }

    return NextResponse.json(
      {
        messageId,
        reactions: reactionSummary,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Update reaction error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
