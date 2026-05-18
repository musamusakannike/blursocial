import { NextRequest } from 'next/server';
import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { Message } from '@/lib/models/Room';
import {
  applyReaction,
  hashClientId,
  normalizeEmoji,
  summarizeReactionsWithHashes,
} from '@/lib/reactions';
import { getSocketServer, setSocketServer } from '@/lib/socketServer';

export const dynamic = 'force-dynamic';

let io: SocketIOServer | null = getSocketServer();

export async function GET(req: NextRequest) {
  if (!io) {
    const httpServer = (req as any).socket?.server as HTTPServer;
    
    if (!httpServer) {
      return new Response('Socket.IO server not available', { status: 500 });
    }

    io = new SocketIOServer(httpServer, {
      path: '/socket.io',
      addTrailingSlash: false,
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      socket.on('join-room', async (roomSlug: string) => {
        socket.join(roomSlug);
        console.log(`Socket ${socket.id} joined room ${roomSlug}`);
        // Broadcast updated count to everyone in the room
        const sockets = await io!.in(roomSlug).allSockets();
        io!.to(roomSlug).emit('room-user-count', sockets.size);
      });

      socket.on('leave-room', async (roomSlug: string) => {
        socket.leave(roomSlug);
        console.log(`Socket ${socket.id} left room ${roomSlug}`);
        // Broadcast updated count after leaving
        const sockets = await io!.in(roomSlug).allSockets();
        io!.to(roomSlug).emit('room-user-count', sockets.size);
      });

      socket.on('send-message', async (data: { roomSlug: string; content: string; tempId: string; replyTo?: { messageId: string; preview: string } }) => {
        try {
          const db = await getDb();
          const room = await db.collection('rooms').findOne({ slug: data.roomSlug });

          if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
          }

          const message: Message = {
            roomId: room._id as ObjectId,
            content: data.content,
            timestamp: new Date(),
            tempId: data.tempId,
            reactions: {},
            ...(data.replyTo && {
              replyTo: {
                messageId: data.replyTo.messageId,
                preview: data.replyTo.preview.substring(0, 100),
              },
            }),
          };

          const result = await db.collection<Message>('messages').insertOne(message);

          const savedMessage = {
            id: result.insertedId.toString(),
            content: message.content,
            timestamp: message.timestamp,
            tempId: data.tempId,
            reactions: [],
            replyTo: message.replyTo,
          };

          io!.to(data.roomSlug).emit('new-message', savedMessage);
        } catch (error) {
          console.error('Error saving message:', error);
          socket.emit('error', { message: 'Failed to send message' });
        }
      });

      socket.on(
        'react-message',
        async (data: {
          roomSlug: string;
          messageId: string;
          emoji: string;
          action: 'add' | 'remove';
          clientId: string;
        }) => {
          try {
            const db = await getDb();
            const room = await db.collection('rooms').findOne({ slug: data.roomSlug });

            if (!room) {
              socket.emit('error', { message: 'Room not found' });
              return;
            }

            if (!ObjectId.isValid(data.messageId)) {
              socket.emit('error', { message: 'Invalid message' });
              return;
            }

            const normalizedEmoji = normalizeEmoji(data.emoji);
            if (!normalizedEmoji) {
              socket.emit('error', { message: 'Invalid emoji' });
              return;
            }

            if (data.action !== 'add' && data.action !== 'remove') {
              socket.emit('error', { message: 'Invalid reaction action' });
              return;
            }

            const clientHash = hashClientId(data.clientId);
            const messageCollection = db.collection<Message>('messages');
            const messageObjectId = new ObjectId(data.messageId);

            const message = await messageCollection.findOne({
              _id: messageObjectId,
              roomId: room._id as ObjectId,
            });

            if (!message) {
              socket.emit('error', { message: 'Message not found' });
              return;
            }

            const updatedReactions = applyReaction(
              { ...(message.reactions ?? {}) },
              normalizedEmoji,
              clientHash,
              data.action
            );

            await messageCollection.updateOne(
              { _id: messageObjectId, roomId: room._id as ObjectId },
              Object.keys(updatedReactions).length > 0
                ? { $set: { reactions: updatedReactions } }
                : { $unset: { reactions: '' } }
            );

            const reactionSummary = summarizeReactionsWithHashes(updatedReactions);

            io!.to(data.roomSlug).emit('message-reactions-updated', {
              messageId: data.messageId,
              reactions: reactionSummary,
            });
          } catch (error) {
            console.error('Error updating reaction:', error);
            socket.emit('error', { message: 'Failed to update reaction' });
          }
        }
      );

      socket.on('disconnecting', async () => {
        // Notify each room this socket was in about the updated count
        for (const roomSlug of socket.rooms) {
          if (roomSlug === socket.id) continue; // skip the socket's own room
          const sockets = await io!.in(roomSlug).allSockets();
          // subtract 1 because the socket hasn't fully left yet
          io!.to(roomSlug).emit('room-user-count', Math.max(sockets.size - 1, 0));
        }
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });

    setSocketServer(io);
  }

  return new Response('Socket.IO server initialized', { status: 200 });
}
