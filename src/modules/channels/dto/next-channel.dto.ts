import { IsString, IsEnum, IsDate, IsNumber, IsOptional } from 'class-validator';
import { ChannelType } from '@prisma/client';

export enum NavigationReason {
  NEXT_PUBLIC = 'NEXT_PUBLIC',
  NEXT_PRIVATE = 'NEXT_PRIVATE',
  NEXT_DM = 'NEXT_DM',
  NO_CHANNELS = 'NO_CHANNELS',
}

export enum SelectionReason {
  CHRONOLOGICAL = 'CHRONOLOGICAL',
  FALLBACK = 'FALLBACK',
  LAST_ACTIVE = 'LAST_ACTIVE',
}

export class NextChannelResponseDto {
  @IsString()
  channelId: string;

  @IsEnum(ChannelType)
  type: ChannelType;

  @IsEnum(NavigationReason)
  reason: NavigationReason;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  memberCount: number;

  @IsDate()
  joinedAt: Date;

  @IsDate()
  lastActivity: Date;

  @IsEnum(SelectionReason)
  selectionReason: SelectionReason;
} 