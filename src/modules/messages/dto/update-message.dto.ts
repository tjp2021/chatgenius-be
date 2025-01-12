import { IsString, IsOptional } from 'class-validator';

export class UpdateMessageDto {
  @IsString()
  @IsOptional()
  content?: string;
} 