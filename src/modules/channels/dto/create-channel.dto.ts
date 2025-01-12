import { IsString, IsEnum, IsOptional, IsArray, MinLength, MaxLength, ArrayMaxSize } from 'class-validator';
import { ChannelType } from '@prisma/client';

export class CreateChannelDto {
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsEnum(ChannelType)
  type: ChannelType;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @ArrayMaxSize(999) // MAX_MEMBERS - 1 for owner
  memberIds?: string[];

  @IsString()
  @IsOptional()
  targetUserId?: string;
} 