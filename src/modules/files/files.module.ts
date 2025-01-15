import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PrismaModule } from '../../lib/prisma.module';
import { FilesController } from './controllers/files.controller';
import { FilesService } from './services/files.service';
import { S3Service } from './services/s3.service';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    MulterModule.register({
      storage: memoryStorage(),
    }),
  ],
  controllers: [FilesController],
  providers: [FilesService, S3Service],
  exports: [FilesService],
})
export class FilesModule {} 