import { Controller, Post, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../modules/users/user.service';
import { Webhook } from 'svix';

@Controller('webhooks')
export class WebhookController {
  constructor(private readonly userService: UserService) {}

  private verifyWebhookSignature(payload: any, signature: string, timestamp: string): boolean {
    const secret = process.env.CLERK_WEBHOOK_SECRET;
    if (!secret) {
      throw new Error('CLERK_WEBHOOK_SECRET is not set');
    }

    const wh = new Webhook(secret);
    try {
      wh.verify(JSON.stringify(payload), {
        'svix-id': '',
        'svix-timestamp': timestamp,
        'svix-signature': signature,
      });
      return true;
    } catch (err) {
      return false;
    }
  }

  @Post('clerk')
  async handleClerkWebhook(
    @Headers('svix-signature') signature: string,
    @Headers('svix-timestamp') timestamp: string,
    @Body() payload: any,
  ) {
    // Verify webhook signature
    if (!this.verifyWebhookSignature(payload, signature, timestamp)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    try {
      switch (payload.type) {
        case 'user.created': {
          const email = payload.data.email_addresses[0]?.email_address;
          const name = payload.data.first_name 
            ? `${payload.data.first_name} ${payload.data.last_name || ''}`
            : email?.split('@')[0] || 'Anonymous';

          await this.userService.createUser({
            id: payload.data.id,
            email,
            name,
            imageUrl: payload.data.image_url,
          });
          break;
        }

        case 'user.updated': {
          await this.userService.updateUser(payload.data.id, {
            name: payload.data.first_name 
              ? `${payload.data.first_name} ${payload.data.last_name || ''}`
              : undefined,
            imageUrl: payload.data.image_url,
          });
          break;
        }

        case 'user.deleted': {
          await this.userService.deleteUser(payload.data.id);
          break;
        }

        case 'session.created': {
          await this.userService.updateUserStatus(payload.data.user_id, 'online');
          break;
        }

        case 'session.ended': {
          await this.userService.updateUserStatus(payload.data.user_id, 'offline');
          break;
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Error handling Clerk webhook:', error);
      throw error;
    }
  }
} 