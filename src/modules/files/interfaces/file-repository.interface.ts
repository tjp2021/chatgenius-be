import { File } from './file.interface';

export interface FileRepository {
  create(file: Omit<File, 'id' | 'createdAt' | 'updatedAt'>): Promise<File>;
  findById(id: string): Promise<File | null>;
  findByUserId(userId: string): Promise<File[]>;
  delete(id: string): Promise<void>;
  search(query: {
    filename?: string;
    type?: string;
    userId?: string;
    skip?: number;
    take?: number;
  }): Promise<{ items: File[]; total: number }>;
} 