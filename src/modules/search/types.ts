import { Message, MessageMetadata } from '../../lib/vector-store.service';

export interface SearchOptions {
  channelId?: string;
  channelIds?: string[];
  topK?: number;
  minScore?: number;
  cursor?: string;
  dateRange?: { start: string; end: string; };
  threadOptions?: {
    include: boolean;
    expand: boolean;
    maxReplies?: number;
    scoreThreshold?: number;
  };
  filters?: {
    messageTypes?: Array<'message' | 'thread_reply' | 'file_share' | 'code_snippet'>;
    hasAttachments?: boolean;
    hasReactions?: boolean;
    fromUsers?: string[];
    excludeUsers?: string[];
  };
}

export interface MessageContent extends Message {
  score: number;
  user: {
    id: string;
    name: string;
  };
  reactions?: Array<{
    emoji: string;
    count: number;
    users: string[];
  }>;
  attachments?: Array<{
    type: string;
    url: string;
    name: string;
    size?: number;
  }>;
  thread?: {
    replyCount: number;
    latestReplies: MessageContent[];
  };
}

export interface SearchResponse {
  items: MessageContent[];
  metadata: {
    searchTime: number;
    totalMatches: number;
    threadMatches?: number;
  };
  pageInfo: {
    hasNextPage: boolean;
    cursor?: string;
    total: number;
  };
}

export interface RAGResponse {
  response: string;
  contextMessageCount: number;
  metadata?: {
    searchTime: number;
    contextQuality: number;
  };
} 