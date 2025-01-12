import { Message, User } from '@prisma/client';

export enum ThreadEventType {
  CREATED = 'thread:created',
  UPDATED = 'thread:updated',
  DELETED = 'thread:deleted',
  REPLY_ADDED = 'thread:reply_added',
  REPLY_UPDATED = 'thread:reply_updated',
  REPLY_DELETED = 'thread:reply_deleted'
}

export interface ThreadEvent {
  type: ThreadEventType;
  threadId: string;
  channelId: string;
  data: {
    threadId: string;
    channelId: string;
    reply?: ThreadReply;
    threadState?: ThreadState;
    replyId?: string;
    messageId?: string;
    userId?: string;
    replyCount?: number;
  };
}

export interface ThreadState {
  id: string;
  channelId: string;
  parentMessageId: string;
  replyCount: number;
  lastReplyAt: Date | null;
  participantCount: number;
}

export interface ThreadReply {
  id: string;
  content: string;
  threadId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  user: Pick<User, 'id' | 'name' | 'imageUrl'>;
}

export interface Thread {
  id: string;
  channelId: string;
  parentMessage: Pick<Message, 'id' | 'content' | 'createdAt' | 'updatedAt'> & {
    user: Pick<User, 'id' | 'name' | 'imageUrl'>;
  };
  replies: ThreadReply[];
  replyCount: number;
  lastReplyAt: Date | null;
  participantCount: number;
}

export interface IThreadService {
  getThread(threadId: string, channelId: string): Promise<Thread>;
  getReplies(threadId: string, channelId: string): Promise<ThreadReply[]>;
  addReply(threadId: string, channelId: string, userId: string, content: string): Promise<ThreadReply>;
  updateReply(threadId: string, replyId: string, userId: string, content: string): Promise<ThreadReply>;
  deleteReply(threadId: string, replyId: string, userId: string): Promise<void>;
  getThreadState(threadId: string): Promise<ThreadState>;
} 