import { IsString, IsNotEmpty, IsUUID, IsDate } from 'class-validator';

export class MessageReactionResponseDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  emoji: string;

  @IsUUID()
  messageId: string;

  @IsUUID()
  userId: string;

  user: {
    id: string;
    name: string | null;
    imageUrl: string | null;
  };

  @IsDate()
  createdAt: Date;
}

export class CreateMessageReactionDto {
  @IsUUID()
  messageId: string;

  @IsString()
  @IsNotEmpty()
  emoji: string;
}

export class DeleteMessageReactionDto {
  @IsUUID()
  messageId: string;

  @IsString()
  @IsNotEmpty()
  emoji: string;
} 