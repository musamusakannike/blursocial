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

    socket.on('disconnect', () => {
      // Update count for all rooms this socket was in
      socket.rooms.forEach((roomSlug) => {
        if (roomSlug === socket.id) return; // skip the default personal room
        const count = io.sockets.adapter.rooms.get(roomSlug)?.size ?? 0;
        io.to(roomSlug).emit('room-user-count', count);
      });
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

    socket.on('disconnect', () => {
      // Update count for all rooms this socket was in before disconnecting
      socket.rooms.forEach((roomSlug) => {
        if (roomSlug === socket.id) return;
        const count = io.sockets.adapter.rooms.get(roomSlug)?.size ?? 0;
        io.to(roomSlug).emit('room-user-count', count);
      });
      console.log('Client disconnected:', socket.id);
    });
  });

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://localhost:${port}`);
      console.log(`> On your network: http://10.215.12.249:${port}`);
    });
});
