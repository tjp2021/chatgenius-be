import { IsString, IsEmail, IsOptional } from 'class-validator';

export class SyncUserDto {
  @IsString()
  id: string;

  @IsEmail()
  email: string;

  @IsString()
  username: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;
} 