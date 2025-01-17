import { Module } from '@nestjs/common';
import { AvatarController } from './avatar.controller';
import { AvatarService } from '../../lib/avatar.service';
import { PrismaModule } from '../../lib/prisma.module';
import { ResponseSynthesisModule } from '../../lib/response-synthesis.module';
import { VectorStoreModule } from '../../lib/vector-store.module';
import { AiService } from '../../lib/ai.service';

@Module({
  imports: [
    PrismaModule,
    ResponseSynthesisModule,
    VectorStoreModule
  ],
  controllers: [AvatarController],
  providers: [AvatarService, AiService],
  exports: [AvatarService]
})
export class AvatarModule {} 