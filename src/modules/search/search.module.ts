import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { VectorStoreModule } from '../../lib/vector-store.module';

@Module({
  imports: [VectorStoreModule],
  controllers: [SearchController],
})
export class SearchModule {} 