import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class DraftSyncDto {
  @IsString()
  @IsNotEmpty()
  channelId: string;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsNumber()
  timestamp: number;

  @IsString()
  @IsNotEmpty()
  deviceId: string;
} 