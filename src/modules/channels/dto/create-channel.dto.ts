import { IsString, IsOptional, IsEnum, ValidateIf } from 'class-validator';
import { ChannelType } from '@prisma/client';

export class CreateChannelDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ChannelType)
  type: ChannelType;

  @IsString()
  @ValidateIf(o => o.type === ChannelType.DM)
  targetUserId?: string;
} 