import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';

export class SearchUsersDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number = 10;
}

export class SearchUsersResponseDto {
  users: {
    id: string;
    name: string | null;
    imageUrl: string | null;
    isOnline: boolean;
  }[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
} 