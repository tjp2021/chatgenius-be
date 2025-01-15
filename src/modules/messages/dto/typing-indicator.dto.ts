import { IsUUID, IsBoolean } from 'class-validator';

export class TypingIndicatorDto {
  @IsUUID()
  channelId: string;

  @IsBoolean()
  isTyping: boolean;
}

export interface TypingStatus {
  userId: string;
  channelId: string;
  isTyping: boolean;
  timestamp: Date;
} 