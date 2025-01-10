import { Prisma } from '@prisma/client';

const messageInclude = {
  user: true,
} as const;

const messageWithReactionsInclude = {
  user: true,
  reactions: {
    include: {
      user: true,
    },
  },
} as const;

const messageWithReadReceiptsInclude = {
  user: true,
  readBy: {
    include: {
      user: true,
    },
  },
} as const;

export const messageWithRelationsInclude = {
  user: true,
  parent: {
    include: {
      user: true,
    },
  },
  replies: {
    include: {
      user: true,
      reactions: {
        include: {
          user: true,
        },
      },
      readBy: {
        include: {
          user: true,
        },
      },
    },
  },
  reactions: {
    include: {
      user: true,
    },
  },
  readBy: {
    include: {
      user: true,
    },
  },
} as const;

export type MessageWithUser = Prisma.MessageGetPayload<{
  include: typeof messageInclude;
}>;

export type MessageWithReactions = Prisma.MessageGetPayload<{
  include: typeof messageWithReactionsInclude;
}>;

export type MessageWithReadReceipts = Prisma.MessageGetPayload<{
  include: typeof messageWithReadReceiptsInclude;
}>;

export type MessageWithRelations = Prisma.MessageGetPayload<{
  include: typeof messageWithRelationsInclude;
}>;

export type MessageResponse = {
  id: string;
  content: string;
  channelId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  parentId: string | null;
  replyCount: number;
  deliveryStatus: string;
  user: {
    id: string;
    name: string | null;
    imageUrl: string | null;
  };
  reactions?: Array<{
    id: string;
    emoji: string;
    userId: string;
    user: {
      id: string;
      name: string | null;
      imageUrl: string | null;
    };
  }>;
  readReceipts?: Array<{
    id: string;
    userId: string;
    readAt: Date;
  }>;
  attachments?: Array<{
    id: string;
    url: string;
    type: string;
    name: string;
  }>;
}; 