import { Message } from '@prisma/client';

export interface SearchOptions {
  userId: string;  // Required - the user performing the search
  limit?: number;
  cursor?: string;  // Base64 encoded cursor
  minScore?: number;
  searchType?: 'semantic' | 'text' | 'thread';  // Type of search to perform
  fromUserId?: string;  // For filtering messages from a specific user
  channelId?: string;  // For filtering messages from a specific channel
  threadId?: string;  // For filtering messages in a specific thread
}

export interface PageInfo {
  hasNextPage: boolean;
  endCursor?: string;
}

export interface SearchResult<T> {
  items: T[];
  pageInfo: PageInfo;
  total: number;
}

// For encoding/decoding cursors
export interface MessageCursor {
  id: string;
  score: number;
  timestamp: string;
}

export type MessageSearchResult = Message & {
  score: number;
  user: {
    id: string;
    name: string;
    imageUrl: string;
  };
  replyTo?: {
    id: string;
    content: string;
    user: {
      id: string;
      name: string;
      imageUrl: string;
    };
  };
}; 