import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ChannelsModule } from './channels/channels.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { MessageModule } from './message/message.module';
import { RedisCacheModule } from './cache/redis.module';
import { SocketGateway } from './gateways/socket.gateway';

@Module({
  imports: [
    ConfigModule.forRoot(),
    PrismaModule,
    ChannelsModule,
    AuthModule,
    UserModule,
    MessageModule,
    RedisCacheModule,
  ],
  controllers: [AppController],
  providers: [AppService, SocketGateway],
})
export class AppModule {}
