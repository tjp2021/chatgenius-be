import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class UpdateMessageDto {
  @IsUUID()
  messageId: string;

  @IsString()
  @IsNotEmpty()
  content: string;
} 