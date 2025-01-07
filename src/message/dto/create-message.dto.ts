import { IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  content: string;

  @IsUUID()
  channelId: string;

  @IsUUID()
  @IsOptional()
  parentId?: string;
} 