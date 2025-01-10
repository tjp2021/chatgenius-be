import { IsString, IsOptional, IsNumber } from 'class-validator';

export class MessageAttachmentDto {
  @IsString()
  url: string;

  @IsString()
  @IsOptional()
  filename?: string;

  @IsString()
  @IsOptional()
  contentType?: string;

  @IsNumber()
  @IsOptional()
  size?: number;
}

export class MessageAttachmentResponseDto extends MessageAttachmentDto {
  @IsString()
  id: string;

  @IsString()
  messageId: string;

  @IsString()
  createdAt: string;

  @IsString()
  updatedAt: string;
} 