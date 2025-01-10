import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class SaveDraftDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsOptional()
  deviceId?: string;
} 