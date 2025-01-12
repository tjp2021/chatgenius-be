import { Module } from '@nestjs/common';
import { PrismaModule } from '../../lib/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [],
  exports: [],
})
export class ThreadsModule {} 