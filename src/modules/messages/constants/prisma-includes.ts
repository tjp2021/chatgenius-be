import { Prisma } from '@prisma/client';

export const baseMessageInclude = {
  user: true,
  channel: true,
} as const;

export const messageWithReactionsInclude = {
  ...baseMessageInclude,
  reactions: {
    include: {
      user: true
    }
  }
} as const;

export const messageWithReadReceiptsInclude = {
  ...baseMessageInclude,
  readBy: {
    include: {
      user: true
    }
  }
} as const;

export const fullMessageInclude = {
  ...baseMessageInclude,
  reactions: {
    include: {
      user: true
    }
  },
  readBy: {
    include: {
      user: true
    }
  }
} as const;

export const threadMessageInclude = {
  ...fullMessageInclude,
  parent: {
    include: fullMessageInclude
  },
  replies: {
    include: fullMessageInclude
  }
} as const;

export type MessageInclude = Prisma.MessageInclude;
export type MessageSelect = Prisma.MessageSelect; 