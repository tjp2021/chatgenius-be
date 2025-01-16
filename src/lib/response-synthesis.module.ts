import { Module } from '@nestjs/common';
import { ResponseSynthesisService } from './response-synthesis.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [ResponseSynthesisService],
  exports: [ResponseSynthesisService]
})
export class ResponseSynthesisModule {} 