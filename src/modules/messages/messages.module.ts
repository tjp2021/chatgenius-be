import { Module } from '@nestjs/common';
import { PrismaModule } from '../../lib/prisma.module';
import { MessagesController } from './controllers/messages.controller';
import { MessagesService } from './services/messages.service';
import { ReactionsController } from './controllers/reactions.controller';
import { ReactionsService } from './services/reactions.service';

@Module({
  imports: [PrismaModule],
  controllers: [MessagesController, ReactionsController],
  providers: [MessagesService, ReactionsService],
  exports: [MessagesService, ReactionsService],
})
export class MessagesModule {} 