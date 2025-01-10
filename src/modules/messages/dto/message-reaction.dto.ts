export interface MessageReactionResponseDto {
  id: string;
  emoji: string;
  messageId: string;
  userId: string;
  user: {
    id: string;
    name: string | null;
    imageUrl: string | null;
  };
  createdAt: Date;
}

export interface CreateMessageReactionDto {
  messageId: string;
  emoji: string;
}

export interface DeleteMessageReactionDto {
  messageId: string;
  emoji: string;
} 