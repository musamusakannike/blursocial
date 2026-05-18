// Override DNS to use public resolvers — local DNS blocks MongoDB SRV lookups
require('dns').setDefaultResultOrder('ipv4first');
require('dns').setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { MongoClient, ObjectId } = require('mongodb');
const {
  hashClientId,
  normalizeEmoji,
  summarizeReactionsWithHashes,
  applyReaction,
} = require('./lib/reactions');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = 3000;

const app = next({ dev, hostname: 'localhost', port });
const handle = app.getRequestHandler();

let db;
let ttlIndexEnsured = false;

async function connectToDatabase() {
  if (db) return db;
  
  const client = await MongoClient.connect(process.env.MONGODB_URI);
  db = client.db('blur_chat');
  return db;
}

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const io = new Server(httpServer, {
    path: '/socket.io',
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join-room', (roomSlug) => {
      socket.join(roomSlug);
      console.log(`Socket ${socket.id} joined room ${roomSlug}`);
      // Broadcast updated count to everyone in the room
      const count = io.sockets.adapter.rooms.get(roomSlug)?.size ?? 1;
      io.to(roomSlug).emit('room-user-count', count);
    });

    socket.on('leave-room', (roomSlug) => {
      socket.leave(roomSlug);
      console.log(`Socket ${socket.id} left room ${roomSlug}`);
      const count = io.sockets.adapter.rooms.get(roomSlug)?.size ?? 0;
      io.to(roomSlug).emit('room-user-count', count);
    });

    socket.on('disconnecting', () => {
      // 'disconnecting' fires before the socket leaves its rooms, so socket.rooms is still populated
      socket.rooms.forEach((roomSlug) => {
        if (roomSlug === socket.id) return; // skip the socket's own personal room
        const room = io.sockets.adapter.rooms.get(roomSlug);
        // subtract 1 because this socket is still counted but is leaving
        const count = room ? Math.max(room.size - 1, 0) : 0;
        io.to(roomSlug).emit('room-user-count', count);
      });
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });

    socket.on('send-message', async (data) => {
      try {
        const database = await connectToDatabase();
        const room = await database.collection('rooms').findOne({ slug: data.roomSlug });

        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        const message = {
          roomId: room._id,
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

        const result = await database.collection('messages').insertOne(message);

        const savedMessage = {
          id: result.insertedId.toString(),
          content: message.content,
          timestamp: message.timestamp,
          tempId: data.tempId,
          reactions: [],
          replyTo: message.replyTo,
        };

        io.to(data.roomSlug).emit('new-message', savedMessage);
      } catch (error) {
        console.error('Error saving message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('react-message', async (data) => {
      try {
        const database = await connectToDatabase();
        const room = await database.collection('rooms').findOne({ slug: data.roomSlug });

        if (!room) {
          socket.emit('error', { message: 'Room not found' });
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

        const message = await database.collection('messages').findOne({
          _id: new ObjectId(data.messageId),
          roomId: room._id,
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

        await database.collection('messages').updateOne(
          { _id: new ObjectId(data.messageId), roomId: room._id },
          Object.keys(updatedReactions).length > 0
            ? { $set: { reactions: updatedReactions } }
            : { $unset: { reactions: '' } }
        );

        io.to(data.roomSlug).emit('message-reactions-updated', {
          messageId: data.messageId,
          reactions: summarizeReactionsWithHashes(updatedReactions),
        });
      } catch (error) {
        console.error('Error updating reaction:', error);
        socket.emit('error', { message: 'Failed to update reaction' });
      }
    });
  });

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, async () => {
      console.log(`> Ready on http://localhost:${port}`);
      console.log(`> On your network: http://10.215.12.249:${port}`);

      // ── Ensure TTL index exists on startup ──────────────────────────────────
      // MongoDB TTL index deletes room documents automatically when expiresAt is reached.
      // expireAfterSeconds: 0 = delete at the exact datetime stored in expiresAt.
      // sparse: true = skip documents where expiresAt is null (permanent rooms).
      try {
        const database = await connectToDatabase();
        await database.collection('rooms').createIndex(
          { expiresAt: 1 },
          { expireAfterSeconds: 0, sparse: true, name: 'rooms_ttl_expiry' }
        );
        console.log('> TTL index on rooms.expiresAt ensured');
      } catch (err) {
        console.warn('> TTL index creation skipped (may already exist):', err.message);
      }

      // ── Orphaned-message cleanup job ────────────────────────────────────────
      // When MongoDB TTL deletes a room, its messages are left behind.
      // This job runs every hour and removes messages whose room no longer exists.
      async function cleanupOrphanedMessages() {
        try {
          const database = await connectToDatabase();

          // Find all distinct roomIds referenced in messages
          const messageRoomIds = await database
            .collection('messages')
            .distinct('roomId');

          if (messageRoomIds.length === 0) return;

          // Find which of those rooms still exist
          const existingRooms = await database
            .collection('rooms')
            .find({ _id: { $in: messageRoomIds } }, { projection: { _id: 1 } })
            .toArray();

          const existingIds = new Set(existingRooms.map((r) => r._id.toString()));

          // Collect roomIds that no longer have a room document
          const orphanedRoomIds = messageRoomIds.filter(
            (id) => !existingIds.has(id.toString())
          );

          if (orphanedRoomIds.length === 0) return;

          const result = await database
            .collection('messages')
            .deleteMany({ roomId: { $in: orphanedRoomIds } });

          if (result.deletedCount > 0) {
            console.log(
              `> Cleanup: removed ${result.deletedCount} orphaned message(s) from ${orphanedRoomIds.length} expired room(s)`
            );
          }
        } catch (err) {
          console.error('> Orphaned-message cleanup failed:', err.message);
        }
      }

      // Run once immediately on startup, then every hour
      cleanupOrphanedMessages();
      setInterval(cleanupOrphanedMessages, 60 * 60 * 1000);
    });
});
