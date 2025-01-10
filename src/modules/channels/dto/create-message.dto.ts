import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MessageAttachmentDto } from './message-attachment.dto';

export class CreateMessageDto {
  @IsString()
  content: string;

  @IsString()
  @IsOptional()
  parentId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageAttachmentDto)
  @IsOptional()
  attachments?: MessageAttachmentDto[];
} 