import { IsString, IsNotEmpty } from 'class-validator';

export class MessageReactionDto {
  @IsString()
  @IsNotEmpty()
  emoji: string;
}

export class MessageReactionResponseDto {
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