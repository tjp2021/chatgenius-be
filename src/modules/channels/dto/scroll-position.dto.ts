import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class ScrollPositionDto {
  @IsString()
  @IsNotEmpty()
  channelId: string;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsNumber()
  position: number;

  @IsNumber()
  timestamp: number;
} 