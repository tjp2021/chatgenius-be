import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../lib/prisma.service';
import { S3Service } from './s3.service';
import { File } from '../interfaces/file.interface';
import { FileRepository } from '../interfaces/file-repository.interface';
import { FileSearchDto } from '../dto/file.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FilesService implements FileRepository {
  private readonly logger = new Logger(FilesService.name);
  private readonly allowedMimeTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  private readonly maxFileSize = 5 * 1024 * 1024; // 5MB

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
  ) {}

  async create(fileData: Express.Multer.File, userId: string): Promise<File> {
    this.validateFile(fileData);

    const key = `${userId}/${uuidv4()}-${fileData.originalname}`;
    const url = await this.s3Service.uploadFile(fileData, key);

    return this.prisma.file.create({
      data: {
        name: fileData.originalname,
        type: fileData.mimetype,
        size: fileData.size,
        url,
        userId,
      },
    });
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
    const where = {
      ...(query.filename && { name: { contains: query.filename } }),
      ...(query.type && { type: query.type }),
    };

    const [items, total] = await Promise.all([
      this.prisma.file.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.file.count({ where }),
    ]);

    const filesWithSignedUrls = await Promise.all(
      items.map(async (file) => ({
        ...file,
        url: await this.s3Service.getSignedUrl(this.getKeyFromUrl(file.url)),
      })),
    );

    return { items: filesWithSignedUrls, total };
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
} 