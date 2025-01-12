import { IsString, IsNotEmpty, IsUUID, IsDate } from 'class-validator';

export class MessageReactionResponseDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  type: string;

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
  @IsString()
  @IsNotEmpty()
  type: string;
}

export class DeleteMessageReactionDto {
  @IsString()
  @IsNotEmpty()
  type: string;
} 