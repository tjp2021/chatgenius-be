import { IsString, IsObject, IsOptional } from 'class-validator';

export class SlackEventDto {
  @IsString()
  type: string;

  @IsString()
  @IsOptional()
  subtype?: string;

  @IsObject()
  event: {
    type: string;
    text: string;
    user: string;
    channel: string;
    thread_ts?: string;
    ts: string;
  };

  @IsString()
  team_id: string;
} 