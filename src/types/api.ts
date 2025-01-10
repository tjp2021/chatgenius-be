export interface APIResponse<T> {
  data: T;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
} 