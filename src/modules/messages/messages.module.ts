import { Module } from '@nestjs/common';
import { PrismaModule } from '../../lib/prisma.module';
import { MessagesController } from './controllers/messages.controller';
import { MessagesService } from './services/messages.service';
import { ReactionsController } from './controllers/reactions.controller';
import { ReactionsService } from './services/reactions.service';
import { VectorStoreModule } from '../../lib/vector-store.module';

@Module({
  imports: [PrismaModule, VectorStoreModule],
  controllers: [MessagesController, ReactionsController],
  providers: [MessagesService, ReactionsService],
  exports: [MessagesService, ReactionsService],
})
export class MessagesModule {} 