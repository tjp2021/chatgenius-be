import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MessageModule } from './modules/messages/message.module';
import { ChannelModule } from './modules/channels/channel.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    MessageModule,
    ChannelModule,
  ],
})
export class AppModule {}
