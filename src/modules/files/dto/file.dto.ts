import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FileUploadDto {
  @ApiProperty({ type: 'string', format: 'binary' })
  file: Express.Multer.File;
}

export class FileSearchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  filename?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  skip?: number;

  @ApiPropertyOptional()
  @IsOptional()
  take?: number;
} 