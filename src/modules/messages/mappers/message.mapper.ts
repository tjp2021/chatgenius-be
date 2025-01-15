import type { Message, User } from '.prisma/client';

export interface MessageResponse {
  id: string;
  content: string;
  channelId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    name: string | null;
    imageUrl: string | null;
  };
}

export class MessageMapper {
  static toResponse(message: Message & { user?: User }): MessageResponse {
    return {
      id: message.id,
      content: message.content,
      channelId: message.channelId,
      userId: message.userId,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      user: message.user ? {
        id: message.user.id,
        name: message.user.name || null,
        imageUrl: message.user.imageUrl || null,
      } : undefined
    };
  }
} 