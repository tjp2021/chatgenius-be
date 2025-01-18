import { MessageMetadata } from '../../../lib/vector-store.service';

export interface PaginationInfo {
  hasNextPage: boolean;
  cursor?: string;
  total: number;
}

export interface UserInfo {
  id: string;
  name: string;
  avatar?: string;
  role: string;
}

export interface ThreadInfo {
  threadId: string;
  replyCount: number;
  participantCount: number;
  lastActivity: string;
  status?: 'active' | 'resolved' | 'archived';
  latestReplies?: MessageContent[];
}

export interface MessageContent {
  id: string;
  content: string;
  metadata: MessageMetadata;
  score?: number;
  user?: UserInfo;
  reactions?: Array<{
    emoji: string;
    count: number;
    users: UserInfo[];
  }>;
  attachments?: Array<{
    type: string;
    url: string;
    name: string;
  }>;
  thread?: ThreadInfo;
}

export interface SearchOptions {
  channelId?: string;
  channelIds?: string[];
  topK?: number;
  minScore?: number;
  cursor?: string;
  dateRange?: { start: string; end: string; };
  sortBy?: 'relevance' | 'date';
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

export interface SearchResponse {
  items: MessageContent[];
  metadata: {
    searchTime: number;
    totalMatches: number;
    threadMatches?: number;
  };
  pageInfo: PaginationInfo;
}

export interface RAGResponse {
  response: string;
  contextMessageCount: number;
  metadata?: {
    searchTime: number;
    contextQuality: number;
  };
}

// For backward compatibility with existing code
export interface SearchResult {
  messages: MessageContent[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
  threadMatches?: number;
}

// For array-like operations in existing code
export type VectorResults = MessageContent[];
export type VectorResult = MessageContent; 