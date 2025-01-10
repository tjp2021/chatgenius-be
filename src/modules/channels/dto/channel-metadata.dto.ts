import { IsString, IsNumber, IsOptional, IsUUID, IsDate, IsEnum } from 'class-validator';
import { ChannelType } from '@prisma/client';

export class ChannelMetadataDto {
  @IsUUID()
  id: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ChannelType)
  type: ChannelType;

  @IsNumber()
  memberCount: number;

  @IsDate()
  lastActivity: Date;

  @IsNumber()
  unreadCount: number;

  @IsString()
  @IsOptional()
  lastMessagePreview?: string;
} 