import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { UserModule } from '../user/user.module';
import { JwtService } from './jwt.service';
import { AuthController } from './auth.controller';
import { JwtGuard } from './jwt.guard';

@Module({
  imports: [UserModule],
  controllers: [WebhookController, AuthController],
  providers: [JwtService, JwtGuard],
  exports: [JwtService, JwtGuard],
})
export class AuthModule {}
