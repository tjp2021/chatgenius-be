import { Injectable, Logger } from '@nestjs/common';
import { S3Service } from '../modules/files/services/s3.service';

@Injectable()
export class FileContentService {
  private readonly logger = new Logger(FileContentService.name);

  constructor(private readonly s3Service: S3Service) {}

  async extractTextContent(s3Key: string): Promise<string> {
    try {
      // Only handle .txt files for now
      if (!s3Key.endsWith('.txt')) {
        throw new Error('Only .txt files are supported in this version');
      }

      // Get the file content using S3Service's public methods
      const fileUrl = await this.s3Service.getSignedUrl(s3Key);
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }
      
      const content = await response.text();
      return content;
    } catch (error) {
      this.logger.error(`Failed to extract text content: ${error.message}`);
      throw error;
    }
  }
} 