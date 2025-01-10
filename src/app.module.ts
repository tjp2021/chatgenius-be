import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CoreModule } from './core/core.module';
import { SharedModule } from './shared/shared.module';
import { ChannelModule } from './modules/channels/channel.module';
import { MessageModule } from './modules/messages/message.module';
import { UserModule } from './modules/users/user.module';
import { ChannelInvitationModule } from './modules/channels/channel-invitation.module';
import { WebhookController } from './auth/webhook.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CoreModule,
    SharedModule,
    ChannelModule,
    MessageModule,
    UserModule,
    ChannelInvitationModule,
  ],
  controllers: [WebhookController],
})
export class AppModule {}
