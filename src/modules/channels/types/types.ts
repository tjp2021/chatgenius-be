import { ChannelType } from '@prisma/client';

export interface NavigationTarget {
  channelId: string;
  type: ChannelType;
  previousChannelId?: string;
  lastViewedAt: Date;
  unreadState: boolean;
}

export interface NavigationState {
  type: 'WELCOME' | 'CHANNEL';
  channel?: NavigationTarget;
}

export interface NavigationHistoryEntry {
  channelId: string;
  viewedAt: Date;
  order: number;
}

export interface TransitionResult {
  success: boolean;
  state: NavigationState;
  error?: {
    code: string;
    message: string;
    attempt: number;
  };
} 