// Auth types
export interface JwtPayload {
  sub: string;
  iat: number;
  exp: number;
}

export interface AuthUser {
  id: string;
}

// Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

// Common types
export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface SearchParams {
  query?: string;
  filters?: Record<string, any>;
} 