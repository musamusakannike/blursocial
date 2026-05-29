import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { Room } from '@/lib/models/Room';
import { Message } from '@/lib/models/Room';
import { hashClientId, summarizeReactions } from '@/lib/reactions';
import Ably from 'ably';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const clientId = request.headers.get('x-client-id') ?? undefined;
    const clientHash = clientId ? hashClientId(clientId) : undefined;

    const db = await getDb();
    const room = await db.collection<Room>('rooms').findOne({ slug });

    if (!room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    const messages = await db
      .collection<Message>('messages')
      .find({ roomId: room._id })
      .sort({ timestamp: 1 })
      .limit(100)
      .toArray();

    return NextResponse.json({
      messages: messages.map((msg) => ({
        id: msg._id!.toString(),
        content: msg.content,
        timestamp: msg.timestamp,
        tempId: msg.tempId,
        reactions: summarizeReactions(msg.reactions ?? {}, clientHash),
        replyTo: msg.replyTo,
        senderHash: msg.senderHash,
      })),
    });
  } catch (error) {
    console.error('Get messages error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { content, tempId, replyTo, senderHash } = await request.json();

    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json(
        { error: 'Message content is required' },
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

    const message: Message = {
      roomId: room._id as ObjectId,
      content: content.trim(),
      timestamp: new Date(),
      tempId,
      reactions: {},
      senderHash: senderHash || null,
      ...(replyTo && {
        replyTo: {
          messageId: replyTo.messageId,
          preview: replyTo.preview.substring(0, 100),
        },
      }),
    };

    const result = await db.collection<Message>('messages').insertOne(message);

    const savedMessage = {
      id: result.insertedId.toString(),
      content: message.content,
      timestamp: message.timestamp,
      tempId,
      reactions: [] as any[],
      replyTo: message.replyTo,
      senderHash: message.senderHash,
    };

    // Broadcast via Ably Rest
    const apiKey = process.env.ABLY_API_KEY;
    if (apiKey) {
      try {
        const ably = new Ably.Rest({ key: apiKey });
        await ably.channels.get(`room:${slug}`).publish('new-message', savedMessage);
      } catch (ablyError) {
        console.error('Ably message broadcast failed:', ablyError);
      }
    } else {
      console.warn('Warning: ABLY_API_KEY is not set. Real-time broadcast skipped.');
    }

    return NextResponse.json(
      {
        message: savedMessage,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create message error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
