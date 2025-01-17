# Frontend Implementation Guide

## Table of Contents
1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Authentication](#authentication)
4. [API Integration](#api-integration)
5. [Component Architecture](#component-architecture)
6. [State Management](#state-management)
7. [Search Implementation](#search-implementation)
8. [Message Threading](#message-threading)
9. [Error Handling](#error-handling)
10. [Performance Optimization](#performance-optimization)

## Overview

This guide outlines the frontend implementation for integrating with our RAG-enabled messaging backend. The frontend provides semantic search capabilities, message threading, and real-time updates.

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **Authentication**: Clerk
- **State Management**: TanStack Query (React Query)
- **Real-time**: WebSocket
- **UI Components**: Shadcn/ui

## Authentication

### Setup Clerk

```typescript
// app/providers.tsx
'use client';

import { ClerkProvider } from '@clerk/nextjs';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      {children}
    </ClerkProvider>
  );
}

// middleware.ts
import { authMiddleware } from "@clerk/nextjs";
 
export default authMiddleware({
  publicRoutes: ["/"],
});
 
export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
```

### API Client Setup

```typescript
// lib/api-client.ts
import { auth } from '@clerk/nextjs';

export class APIClient {
  private static baseUrl = process.env.NEXT_PUBLIC_API_URL;
  
  static async getHeaders() {
    const { getToken } = auth();
    const token = await getToken();
    
    return {
      'Authorization': token,
      'Content-Type': 'application/json'
    };
  }
  
  static async get<T>(endpoint: string): Promise<T> {
    const headers = await this.getHeaders();
    const response = await fetch(`${this.baseUrl}${endpoint}`, { headers });
    
    if (!response.ok) {
      throw new Error('API request failed');
    }
    
    return response.json();
  }
  
  static async post<T>(endpoint: string, data: any): Promise<T> {
    const headers = await this.getHeaders();
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error('API request failed');
    }
    
    return response.json();
  }
}
```

## API Integration

### Types

```typescript
// types/api.ts
export interface Message {
  id: string;
  content: string;
  userId: string;
  channelId: string;
  replyTo?: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    imageUrl: string;
  };
}

export interface SearchMessagesRequest {
  query: string;
  limit?: number;
  cursor?: string;
  minScore?: number;
  searchType?: 'semantic' | 'text';
}

export interface SearchMessagesResponse {
  items: Array<Message & { score: number }>;
  pageInfo: {
    hasNextPage: boolean;
    endCursor?: string;
  };
  total: number;
}

export interface ThreadMessagesRequest {
  messageId: string;
  limit?: number;
  cursor?: string;
}

export interface ThreadMessagesResponse {
  items: Message[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor?: string;
  };
}
```

### API Hooks

```typescript
// hooks/api.ts
import { useQuery, useMutation } from '@tanstack/react-query';
import { APIClient } from '@/lib/api-client';
import type { 
  SearchMessagesRequest, 
  SearchMessagesResponse,
  ThreadMessagesRequest,
  ThreadMessagesResponse 
} from '@/types/api';

export function useSearchMessages(params: SearchMessagesRequest) {
  return useQuery({
    queryKey: ['messages', 'search', params],
    queryFn: () => APIClient.post<SearchMessagesResponse>('/messages/search', params),
    keepPreviousData: true
  });
}

export function useThreadMessages(params: ThreadMessagesRequest) {
  return useQuery({
    queryKey: ['messages', 'thread', params.messageId],
    queryFn: () => APIClient.get<ThreadMessagesResponse>(`/messages/thread/${params.messageId}`),
    keepPreviousData: true
  });
}

export function useCreateMessage() {
  return useMutation({
    mutationFn: (data: { content: string; channelId: string; replyTo?: string }) =>
      APIClient.post('/messages', data)
  });
}
```

## Component Architecture

### Search Component

```typescript
// components/search/SearchInput.tsx
'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSearchMessages } from '@/hooks/api';
import { SearchMessagesRequest } from '@/types/api';

export function SearchInput() {
  const [query, setQuery] = useState('');
  const [searchParams, setSearchParams] = useState<SearchMessagesRequest>({
    query: '',
    limit: 10,
    searchType: 'semantic'
  });
  
  const { data, isLoading, error } = useSearchMessages(searchParams);
  
  const handleSearch = () => {
    setSearchParams(prev => ({ ...prev, query }));
  };
  
  return (
    <div className="flex gap-2">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search messages..."
        className="flex-1"
      />
      <Button 
        onClick={handleSearch}
        disabled={isLoading}
      >
        Search
      </Button>
    </div>
  );
}

// components/search/SearchResults.tsx
'use client';

import { useSearchMessages } from '@/hooks/api';
import { MessageCard } from '@/components/messages/MessageCard';

interface SearchResultsProps {
  searchParams: SearchMessagesRequest;
}

export function SearchResults({ searchParams }: SearchResultsProps) {
  const { data, isLoading, error } = useSearchMessages(searchParams);
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data?.items.length) return <div>No results found</div>;
  
  return (
    <div className="space-y-4">
      {data.items.map(message => (
        <MessageCard
          key={message.id}
          message={message}
          score={message.score}
        />
      ))}
      {data.pageInfo.hasNextPage && (
        <Button
          onClick={() => {/* Implement load more */}}
        >
          Load More
        </Button>
      )}
    </div>
  );
}
```

### Message Components

```typescript
// components/messages/MessageCard.tsx
interface MessageCardProps {
  message: Message;
  score?: number;
}

export function MessageCard({ message, score }: MessageCardProps) {
  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <div className="flex items-center gap-2 mb-2">
        <Avatar src={message.user.imageUrl} alt={message.user.name} />
        <div>
          <div className="font-medium">{message.user.name}</div>
          {score && (
            <div className="text-sm text-gray-500">
              Relevance: {Math.round(score * 100)}%
            </div>
          )}
        </div>
      </div>
      <div className="text-gray-700">{message.content}</div>
      {message.replyTo && (
        <div className="mt-2 p-2 bg-gray-50 rounded">
          <div className="text-sm text-gray-500">
            Replying to {message.replyTo.user.name}
          </div>
          <div className="text-gray-600">{message.replyTo.content}</div>
        </div>
      )}
    </div>
  );
}

// components/messages/ThreadView.tsx
interface ThreadViewProps {
  messageId: string;
}

export function ThreadView({ messageId }: ThreadViewProps) {
  const { data, isLoading } = useThreadMessages({ messageId });
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <div className="space-y-4">
      {data?.items.map(message => (
        <MessageCard
          key={message.id}
          message={message}
        />
      ))}
    </div>
  );
}
```

## State Management

### React Query Setup

```typescript
// app/providers.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider } from '@clerk/nextjs';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1
    }
  }
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </ClerkProvider>
  );
}
```

## Search Implementation

### Search Page

```typescript
// app/search/page.tsx
'use client';

import { useState } from 'react';
import { SearchInput } from '@/components/search/SearchInput';
import { SearchResults } from '@/components/search/SearchResults';
import { SearchMessagesRequest } from '@/types/api';

export default function SearchPage() {
  const [searchParams, setSearchParams] = useState<SearchMessagesRequest>({
    query: '',
    limit: 10,
    searchType: 'semantic',
    minScore: 0.7
  });
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Search Messages</h1>
      <div className="space-y-6">
        <SearchInput
          onSearch={(query) => setSearchParams(prev => ({ ...prev, query }))}
        />
        <div className="flex gap-4 items-center">
          <select
            value={searchParams.searchType}
            onChange={(e) => setSearchParams(prev => ({
              ...prev,
              searchType: e.target.value as 'semantic' | 'text'
            }))}
            className="p-2 border rounded"
          >
            <option value="semantic">Semantic Search</option>
            <option value="text">Text Search</option>
          </select>
          <div className="flex items-center gap-2">
            <label>Min Score:</label>
            <input
              type="number"
              value={searchParams.minScore}
              onChange={(e) => setSearchParams(prev => ({
                ...prev,
                minScore: parseFloat(e.target.value)
              }))}
              min={0}
              max={1}
              step={0.1}
              className="w-20 p-2 border rounded"
            />
          </div>
        </div>
        <SearchResults searchParams={searchParams} />
      </div>
    </div>
  );
}
```

## Message Threading

### Thread Modal

```typescript
// components/messages/ThreadModal.tsx
'use client';

import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { ThreadView } from '@/components/messages/ThreadView';

interface ThreadModalProps {
  messageId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ThreadModal({ messageId, isOpen, onClose }: ThreadModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <h2 className="text-lg font-semibold">Message Thread</h2>
        </DialogHeader>
        <ThreadView messageId={messageId} />
      </DialogContent>
    </Dialog>
  );
}
```

## Error Handling

```typescript
// lib/error-handling.ts
export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// components/ui/error-boundary.tsx
'use client';

import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 border border-red-500 rounded bg-red-50">
          <h2 className="text-red-700 font-semibold">Something went wrong</h2>
          <p className="text-red-600">{this.state.error?.message}</p>
        </div>
      );
    }

    return this.props.children;
  }
}
```

## Performance Optimization

### Infinite Scroll Implementation

```typescript
// hooks/use-infinite-scroll.ts
import { useInView } from 'react-intersection-observer';
import { useEffect } from 'react';

export function useInfiniteScroll(
  hasNextPage: boolean,
  isFetching: boolean,
  fetchNextPage: () => void
) {
  const { ref, inView } = useInView();

  useEffect(() => {
    if (inView && hasNextPage && !isFetching) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetching, fetchNextPage]);

  return { ref };
}

// components/search/InfiniteSearchResults.tsx
'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll';
import { MessageCard } from '@/components/messages/MessageCard';
import type { SearchMessagesRequest, SearchMessagesResponse } from '@/types/api';

interface InfiniteSearchResultsProps {
  searchParams: SearchMessagesRequest;
}

export function InfiniteSearchResults({ searchParams }: InfiniteSearchResultsProps) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isError,
    error
  } = useInfiniteQuery({
    queryKey: ['messages', 'search', searchParams],
    queryFn: ({ pageParam }) => APIClient.post<SearchMessagesResponse>('/messages/search', {
      ...searchParams,
      cursor: pageParam
    }),
    getNextPageParam: (lastPage) => lastPage.pageInfo.endCursor
  });

  const { ref } = useInfiniteScroll(
    !!hasNextPage,
    isFetching,
    fetchNextPage
  );

  if (isError) return <div>Error: {error.message}</div>;

  return (
    <div className="space-y-4">
      {data?.pages.map((page, i) => (
        <div key={i} className="space-y-4">
          {page.items.map(message => (
            <MessageCard
              key={message.id}
              message={message}
              score={message.score}
            />
          ))}
        </div>
      ))}
      <div ref={ref}>
        {isFetching && <div>Loading more...</div>}
      </div>
    </div>
  );
}
```

### Image Optimization

```typescript
// components/messages/UserAvatar.tsx
import Image from 'next/image';

interface UserAvatarProps {
  src: string;
  alt: string;
  size?: number;
}

export function UserAvatar({ src, alt, size = 40 }: UserAvatarProps) {
  return (
    <div className="relative rounded-full overflow-hidden" style={{ width: size, height: size }}>
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover"
        sizes={`${size}px`}
      />
    </div>
  );
}
```

### Memoization

```typescript
// components/messages/MessageList.tsx
import { memo } from 'react';
import { MessageCard } from './MessageCard';
import type { Message } from '@/types/api';

interface MessageListProps {
  messages: Message[];
  onMessageClick?: (messageId: string) => void;
}

export const MessageList = memo(function MessageList({ 
  messages,
  onMessageClick
}: MessageListProps) {
  return (
    <div className="space-y-4">
      {messages.map(message => (
        <MessageCard
          key={message.id}
          message={message}
          onClick={() => onMessageClick?.(message.id)}
        />
      ))}
    </div>
  );
});
```

## Environment Setup

Create a `.env.local` file with the following variables:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3002
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
```

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

4. Start production server:
```bash
npm start
```

## Testing

```typescript
// __tests__/components/SearchInput.test.tsx
import { render, fireEvent, waitFor } from '@testing-library/react';
import { SearchInput } from '@/components/search/SearchInput';

describe('SearchInput', () => {
  it('should handle search input changes', () => {
    const { getByPlaceholderText } = render(<SearchInput />);
    const input = getByPlaceholderText('Search messages...');
    
    fireEvent.change(input, { target: { value: 'test query' } });
    
    expect(input).toHaveValue('test query');
  });
  
  // Add more tests...
});
```