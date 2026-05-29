import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { createSession } from '@/lib/auth';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { User } from '@/lib/models/User';

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();

    if (!idToken) {
      return NextResponse.json(
        { error: 'ID token is required' },
        { status: 400 }
      );
    }

    const adminAuth = getAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    const { uid, email, name, picture } = decodedToken;

    if (!email) {
      return NextResponse.json(
        { error: 'Google account must have an email address' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const usersCollection = db.collection<User>('users');

    let user = await usersCollection.findOne({ googleId: uid });

    if (!user) {
      user = await usersCollection.findOne({ email });
    }

    if (user) {
      if (!user.googleId) {
        await usersCollection.updateOne(
          { _id: user._id },
          { $set: { googleId: uid, avatar: picture ?? user.avatar } }
        );
      }
    } else {
      const baseUsername = (name ?? email.split('@')[0])
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .slice(0, 18);

      let username = baseUsername;
      let suffix = 1;
      while (await usersCollection.findOne({ username })) {
        username = `${baseUsername}_${suffix++}`;
      }

      const result = await usersCollection.insertOne({
        username,
        googleId: uid,
        email,
        avatar: picture,
        createdAt: new Date(),
      });

      user = await usersCollection.findOne({ _id: result.insertedId });
    }

    await createSession(user!._id!.toString());

    return NextResponse.json({
      success: true,
      user: {
        id: user!._id!.toString(),
        username: user!.username,
        avatar: user!.avatar,
      },
    });
  } catch (error) {
    console.error('Google auth error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 401 }
    );
  }
}
