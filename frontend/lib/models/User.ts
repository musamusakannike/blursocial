import { ObjectId } from 'mongodb';

export interface User {
  _id?: ObjectId;
  username: string;
  password?: string;
  googleId?: string;
  email?: string;
  avatar?: string;
  createdAt: Date;
}

export interface UserWithoutPassword {
  _id: ObjectId;
  username: string;
  googleId?: string;
  email?: string;
  avatar?: string;
  createdAt: Date;
}
