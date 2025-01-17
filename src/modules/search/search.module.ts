import { Module } from '@nestjs/common';
import { MessagesModule } from '../messages/messages.module';
import { VectorStoreModule } from '../../lib/vector-store.module';
import { ResponseSynthesisModule } from '../../lib/response-synthesis.module';
import { SearchService } from './services/search.service';
import { SearchController } from './controllers/search.controller';

@Module({
  imports: [
    MessagesModule,
    VectorStoreModule,
    ResponseSynthesisModule
  ],
  providers: [SearchService],
  controllers: [SearchController],
  exports: [SearchService]
})
export class SearchModule {} 