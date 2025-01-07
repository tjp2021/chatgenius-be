import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { UserModule } from '../user/user.module';

@Module({
  imports: [UserModule],
  controllers: [WebhookController],
})
export class AuthModule {}
