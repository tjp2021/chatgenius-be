import { IsString, IsOptional, IsArray, IsUUID } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  content: string;

  @IsOptional()
  @IsUUID()
  replyToId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
} 