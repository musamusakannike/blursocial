import { ObjectId } from 'mongodb';

export interface Room {
  _id?: ObjectId;
  name: string;
  slug: string;
  password: string;
  createdBy: ObjectId;
  createdAt: Date;
  // 1. Add the expiration field here
  // It's optional (?) because permanent rooms will have it as null
  expiresAt?: Date | null; 
}

export interface Message {
  _id?: ObjectId;
  roomId: ObjectId;
  content: string;
  timestamp: Date;
  tempId?: string;
  reactions?: Record<string, string[]>;
  replyTo?: {
    messageId: string;
    preview: string;
  };
  senderHash?: string | null;
}