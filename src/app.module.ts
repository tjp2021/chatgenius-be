import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { MessageModule } from './message/message.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ChannelsModule } from './channels/channels.module';
import { GatewayModule } from './gateways/gateway.module';
import { MessageGatewayModule } from './gateways/message-gateway.module';
import { RedisCacheModule } from './cache/redis.module';
import { SocketGateway } from './gateways/socket.gateway';

@Module({
  imports: [
    ConfigModule.forRoot(),
    PrismaModule,
    MessageModule,
    AuthModule,
    UserModule,
    ChannelsModule,
    GatewayModule,
    MessageGatewayModule,
    RedisCacheModule,
  ],
  controllers: [AppController],
  providers: [AppService, SocketGateway],
})
export class AppModule {}
