import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class UpdateChannelDto {
  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(50)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
} 