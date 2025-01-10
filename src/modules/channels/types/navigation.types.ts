import { ChannelType } from '../../../shared/types/prisma.types';

export interface NavigationTarget {
  id: string;
  name: string;
  type: ChannelType;
  unreadCount: number;
  lastMessage?: {
    content: string;
    createdAt: string;
    sender: {
      id: string;
      name: string;
    };
  };
}

export interface NavigationState {
  type: 'CHANNEL' | 'WELCOME';
  channel?: NavigationTarget;
}

export interface TransitionResult {
  success: boolean;
  state: NavigationState;
  error?: string;
} 