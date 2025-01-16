import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../lib/prisma.service';
import { S3Service } from './s3.service';
import { File } from '../interfaces/file.interface';
import { FileRepository } from '../interfaces/file-repository.interface';
import { FileSearchDto } from '../dto/file.dto';
import { v4 as uuidv4 } from 'uuid';
import pdfParse from 'pdf-parse';
import { TextChunkingService } from '../../../lib/text-chunking.service';
import { VectorStoreService } from '../../../lib/vector-store.service';

@Injectable()
export class FilesService implements FileRepository {
  private readonly logger = new Logger(FilesService.name);
  private readonly allowedMimeTypes = ['image/jpeg', 'image/png', 'application/pdf', 'text/plain'];
  private readonly maxFileSize = 5 * 1024 * 1024; // 5MB

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly textChunkingService: TextChunkingService,
    private readonly vectorStoreService: VectorStoreService,
  ) {}

  async create(file: Omit<File, 'id' | 'createdAt' | 'updatedAt'>): Promise<File>;
  async create(fileData: Express.Multer.File, userId: string): Promise<File>;
  async create(
    fileOrData: Express.Multer.File | Omit<File, 'id' | 'createdAt' | 'updatedAt'>,
    userId?: string
  ): Promise<File> {
    if (this.isMulterFile(fileOrData)) {
      this.validateFile(fileOrData);
      const key = `${userId}/${uuidv4()}-${fileOrData.originalname}`;
      const url = await this.s3Service.uploadFile(fileOrData, key);

      // Extract text content for supported file types
      let textContent: string | null = null;
      let vectorIds: string[] = [];
      
      if (['application/pdf', 'text/plain'].includes(fileOrData.mimetype)) {
        try {
          // Extract text content
          if (fileOrData.mimetype === 'application/pdf') {
            const data = await pdfParse(fileOrData.buffer);
            textContent = data.text;
          } else {
            textContent = fileOrData.buffer.toString('utf-8');
          }
          this.logger.debug(`Successfully extracted text content from ${fileOrData.originalname}`);

          // If text extraction successful, chunk and store in vector DB
          if (textContent) {
            const chunks = this.textChunkingService.chunkText(textContent, {
              messageId: key, // Using S3 key as message ID
              timestamp: new Date().toISOString(),
              userId: userId!,
              channelId: 'file-content', // Special channel ID for file content
            });

            // Store chunks in vector DB
            const chunkIds = await Promise.all(
              chunks.map(async (chunk) => {
                const chunkId = `${key}-chunk-${chunk.metadata.chunkIndex}`;
                await this.vectorStoreService.storeMessage(
                  chunkId,
                  chunk.content,
                  {
                    ...chunk.metadata,
                    fileId: key,
                    fileName: fileOrData.originalname,
                    mimeType: fileOrData.mimetype,
                  }
                );
                return chunkId;
              })
            );

            vectorIds = chunkIds;
            this.logger.debug(`Successfully stored ${vectorIds.length} chunks in vector DB`);
          }
        } catch (error) {
          this.logger.error(`Failed to extract text content from ${fileOrData.originalname}: ${error.message}`);
          // Don't throw - we still want to save the file even if text extraction fails
        }
      }

      return this.prisma.file.create({
        data: {
          name: fileOrData.originalname,
          type: fileOrData.mimetype,
          size: fileOrData.size,
          url,
          textContent,
          vectorIds: vectorIds.length > 0 ? vectorIds : undefined,
          user: {
            connect: {
              id: userId!
            }
          }
        },
      });
    } else {
      return this.prisma.file.create({
        data: fileOrData,
      });
    }
  }

  private isMulterFile(file: any): file is Express.Multer.File {
    return 'originalname' in file && 'mimetype' in file && 'size' in file;
  }

  async findById(id: string): Promise<File | null> {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (file) {
      file.url = await this.s3Service.getSignedUrl(this.getKeyFromUrl(file.url));
    }
    return file;
  }

  async findByUserId(userId: string): Promise<File[]> {
    const files = await this.prisma.file.findMany({ where: { userId } });
    return Promise.all(
      files.map(async (file) => ({
        ...file,
        url: await this.s3Service.getSignedUrl(this.getKeyFromUrl(file.url)),
      })),
    );
  }

  async delete(id: string): Promise<void> {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file) return;

    await this.s3Service.deleteFile(this.getKeyFromUrl(file.url));
    await this.prisma.file.delete({ where: { id } });
  }

  async search(query: FileSearchDto): Promise<{ items: File[]; total: number }> {
    try {
      const where = {
        ...(query.filename && { name: { contains: query.filename } }),
        ...(query.type && { type: query.type }),
        ...(query.userId && { userId: query.userId }),
      };

      const [items, total] = await Promise.all([
        this.prisma.file.findMany({
          where,
          skip: query.skip || 0,
          take: query.take || 10,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.file.count({ where }),
      ]);

      const filesWithSignedUrls = await Promise.all(
        items.map(async (file) => {
          try {
            return {
              ...file,
              url: await this.s3Service.getSignedUrl(this.getKeyFromUrl(file.url)),
            };
          } catch (error) {
            this.logger.error(`Failed to generate signed URL for file ${file.id}: ${error.message}`);
            return {
              ...file,
              url: file.url, // Return original URL if signing fails
            };
          }
        }),
      );

      return { 
        items: filesWithSignedUrls, 
        total 
      };
    } catch (error) {
      this.logger.error(`Failed to search files: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to search files');
    }
  }

  private validateFile(file: Express.Multer.File): void {
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${this.allowedMimeTypes.join(', ')}`,
      );
    }

    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds maximum limit of ${this.maxFileSize / 1024 / 1024}MB`,
      );
    }
  }

  private getKeyFromUrl(url: string): string {
    const urlParts = url.split('/');
    return urlParts.slice(3).join('/');
  }

  async extractTextContent(fileId: string): Promise<string> {
    try {
      const file = await this.prisma.file.findUnique({
        where: { id: fileId },
      });

      if (!file) {
        throw new BadRequestException('File not found');
      }

      if (!['application/pdf', 'text/plain'].includes(file.type)) {
        throw new BadRequestException(`Unsupported file type for text extraction: ${file.type}`);
      }

      const response = await fetch(file.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();

      if (file.type === 'application/pdf') {
        const data = await pdfParse(Buffer.from(buffer));
        return data.text;
      } else {
        // Text files
        const decoder = new TextDecoder('utf-8');
        return decoder.decode(buffer);
      }
    } catch (error) {
      this.logger.error(`Failed to extract text content: ${error.message}`);
      throw error;
    }
  }
} 