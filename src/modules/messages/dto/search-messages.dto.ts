export class SearchMessagesDto {
  query: string;
  limit?: number;
  cursor?: string;
  minScore?: number;
  searchType?: 'semantic' | 'text';
} 