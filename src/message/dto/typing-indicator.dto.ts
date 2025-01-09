import { IsUUID, IsBoolean } from 'class-validator';

export class TypingIndicatorDto {
  @IsUUID()
  channelId: string;

  @IsBoolean()
  isTyping: boolean;
} 