import { IsString, IsNumber, IsOptional } from 'class-validator';

export class ChannelMetadataDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  unreadCount: number;

  @IsNumber()
  memberCount: number;

  @IsString()
  @IsOptional()
  lastMessagePreview?: string;
} 