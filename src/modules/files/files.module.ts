import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../lib/prisma.module';
import { FilesController } from './controllers/files.controller';
import { FilesService } from './services/files.service';
import { S3Service } from './services/s3.service';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
  ],
  controllers: [FilesController],
  providers: [FilesService, S3Service],
  exports: [FilesService],
})
export class FilesModule {} 