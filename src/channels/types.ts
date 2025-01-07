import { ChannelType } from '@prisma/client';

export interface NavigationTarget {
  channelId: string;
  type: ChannelType;
} 