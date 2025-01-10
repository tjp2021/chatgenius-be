import { ApiResponse } from '../types';

export function createApiResponse<T>(data?: T, error?: string, meta?: ApiResponse<T>['meta']): ApiResponse<T> {
  return {
    data,
    error,
    meta,
  };
}

export function getPaginationParams(page?: number | string, limit?: number | string) {
  const parsedPage = Math.max(1, Number(page) || 1);
  const parsedLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  
  return {
    skip: (parsedPage - 1) * parsedLimit,
    take: parsedLimit,
    page: parsedPage,
    limit: parsedLimit,
  };
}

export function isValidId(id: string): boolean {
  return typeof id === 'string' && id.length > 0;
}

export function sanitizeSearchQuery(query?: string): string {
  if (!query) return '';
  return query.trim().toLowerCase();
} 