import { Message } from '../../core/events/event.types';
import { MessageDeliveryStatus as PrismaMessageDeliveryStatus } from '@prisma/client';

export { PrismaMessageDeliveryStatus as MessageDeliveryStatus };

export interface MessageDeliveryInfo {
  messageId: string;
  status: PrismaMessageDeliveryStatus;
  recipientId: string;
  timestamp: Date;
  retryCount?: number;
}

export interface MessageWithDelivery extends Message {
  deliveryStatus: PrismaMessageDeliveryStatus;
  deliveredAt?: Date;
  seenAt?: Date;
}

export interface CreateMessageDto {
  content: string;
  channelId: string;
  parentId?: string;
}

export interface UpdateMessageDto {
  id: string;
  content: string;
}

export interface MessageQuery {
  channelId: string;
  cursor?: string;
  limit?: number;
}

export interface MessageRepository {
  create(userId: string, data: CreateMessageDto): Promise<Message>;
  update(userId: string, data: UpdateMessageDto): Promise<Message>;
  delete(userId: string, id: string): Promise<boolean>;
  findById(id: string): Promise<Message | null>;
  findByChannel(query: MessageQuery): Promise<Message[]>;
} 