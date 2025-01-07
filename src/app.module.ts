import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ChannelsModule } from './channels/channels.module';
import { MessageModule } from './message/message.module';
import { RedisCacheModule } from './cache/redis.module';
import { GatewayModule } from './gateways/gateway.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    UserModule,
    ChannelsModule,
    MessageModule,
    RedisCacheModule,
    GatewayModule,
  ],
})
export class AppModule {}
