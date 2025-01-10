import { MessageResponse } from '../types/message.types';
import { MessageDeliveryStatus } from '@prisma/client';

export class ThreadResponseDto {
  parentMessage: MessageResponse;
  replies: {
    id: string;
    content: string;
    createdAt: Date;
    user: {
      id: string;
      name: string | null;
      imageUrl: string | null;
    };
    parentId: string;
    replyCount: number;
    channelId: string;
    userId: string;
    updatedAt: Date;
    deliveryStatus: MessageDeliveryStatus;
  }[];
  participantCount: number;
  lastReplyAt: Date;
} 