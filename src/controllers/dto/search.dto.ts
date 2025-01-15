import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SearchRequestDto {
  @ApiProperty({
    description: 'The question to search for similar messages',
    example: 'How do I reset my password?',
  })
  @IsString()
  @MinLength(3)
  query: string;
}

export class SearchResponseDto {
  @ApiProperty({
    description: 'Array of search results with relevance scores',
  })
  results: {
    messageId: string;
    content: string;
    score: number;
  }[];
} 