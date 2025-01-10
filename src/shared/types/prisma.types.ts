import { Prisma } from '@prisma/client';

// Export enum values as const objects for type safety
export const ChannelType = {
  PUBLIC: 'PUBLIC' as const,
  PRIVATE: 'PRIVATE' as const,
  DM: 'DM' as const,
} as const;

export const MemberRole = {
  OWNER: 'OWNER' as const,
  ADMIN: 'ADMIN' as const,
  MEMBER: 'MEMBER' as const,
} as const;

export const MessageDeliveryStatus = {
  SENDING: 'SENDING' as const,
  SENT: 'SENT' as const,
  DELIVERED: 'DELIVERED' as const,
  READ: 'READ' as const,
  FAILED: 'FAILED' as const,
} as const;

export const UserRole = {
  USER: 'USER' as const,
  ADMIN: 'ADMIN' as const,
} as const;

// Export types based on const objects
export type ChannelType = typeof ChannelType[keyof typeof ChannelType];
export type MemberRole = typeof MemberRole[keyof typeof MemberRole];
export type MessageDeliveryStatus = typeof MessageDeliveryStatus[keyof typeof MessageDeliveryStatus];
export type UserRole = typeof UserRole[keyof typeof UserRole];