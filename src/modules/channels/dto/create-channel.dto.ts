import { IsString, IsEnum, IsOptional, IsArray, MinLength, MaxLength, ArrayMaxSize, ValidateIf } from 'class-validator';
import { ChannelType } from '@prisma/client';

export class CreateChannelDto {
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @ValidateIf(o => o.type !== ChannelType.DM)
  name?: string;

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
  @ValidateIf(o => o.type !== ChannelType.DM)
  memberIds?: string[];

  @IsString()
  @ValidateIf(o => o.type === ChannelType.DM)
  targetUserId?: string;
} 