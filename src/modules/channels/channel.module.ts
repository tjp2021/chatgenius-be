import { Module } from '@nestjs/common';
import { PrismaService } from '@/lib/prisma.service';

@Module({
  imports: [],
  providers: [PrismaService],
  exports: [],
})
export class ChannelModule {} 