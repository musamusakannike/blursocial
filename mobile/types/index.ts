export interface User {
  username: string;
}

export interface Room {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  duration?: number;
  expiresAt?: Date | null;
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  reacted?: boolean;
  hashes?: string[];
}

export interface Message {
  id: string;
  content: string;
  timestamp: Date;
  tempId?: string;
  isOptimistic?: boolean;
  reactions: ReactionSummary[];
  replyTo?: {
    messageId: string;
    preview: string;
  };
  senderHash?: string | null;
}

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}
