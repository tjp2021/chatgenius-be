import { Module } from '@nestjs/common';
import { PrismaModule } from '../../lib/prisma.module';
import { ThreadsController } from './controllers/threads.controller';
import { ThreadsService } from './services/threads.service';

@Module({
  imports: [PrismaModule],
  controllers: [ThreadsController],
  providers: [ThreadsService],
  exports: [ThreadsService],
})
export class ThreadsModule {} 