import { IsString, IsNotEmpty, IsNumber, IsOptional, IsBoolean, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

class BasicMetadata {
  @IsNumber()
  @IsOptional()
  memberCount?: number;

  @IsNumber()
  @IsOptional()
  unreadCount?: number;

  @IsBoolean()
  @IsOptional()
  hasUnreadMentions?: boolean;
}

class LastMessage {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsNotEmpty()
  authorName: string;

  @IsString()
  @IsNotEmpty()
  timestamp: string;
}

class TopContributor {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  messageCount: number;

  @IsString()
  @IsNotEmpty()
  lastActive: string;
}

class ActivityMetrics {
  @IsNumber()
  messagesLast24h: number;

  @IsNumber()
  uniqueUsers24h: number;

  @IsArray()
  @IsNumber({}, { each: true })
  peakHours: number[];
}

class DetailedMetadata {
  @IsString()
  @IsOptional()
  description?: string;

  @ValidateNested()
  @Type(() => LastMessage)
  @IsOptional()
  lastMessage?: LastMessage;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TopContributor)
  @IsOptional()
  topContributors?: TopContributor[];

  @ValidateNested()
  @Type(() => ActivityMetrics)
  @IsOptional()
  activityMetrics?: ActivityMetrics;
}

export class MetadataUpdateDto {
  @IsString()
  @IsNotEmpty()
  channelId: string;

  @ValidateNested()
  @Type(() => BasicMetadata)
  @IsOptional()
  basic?: BasicMetadata;

  @ValidateNested()
  @Type(() => DetailedMetadata)
  @IsOptional()
  detailed?: DetailedMetadata;

  @IsNumber()
  timestamp: number;
} 