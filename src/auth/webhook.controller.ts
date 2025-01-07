import { Controller, Post, Headers, HttpCode, UnauthorizedException, Logger, RawBodyRequest, Req } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { WebhookEvent } from '@clerk/nextjs/server';
import { Request } from 'express';
import { Webhook, WebhookRequiredHeaders } from 'svix';

@Controller('webhooks/clerk')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);
  private readonly wh: Webhook;
  
  constructor(private userService: UserService) {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    this.logger.debug('Webhook Secret:', webhookSecret?.substring(0, 4) + '...');
    
    if (!webhookSecret) {
      throw new Error('CLERK_WEBHOOK_SECRET is not set');
    }
    this.wh = new Webhook(webhookSecret);
  }

  @Post()
  @HttpCode(200)
  async handleWebhook(
    @Headers('svix-id') svixId: string,
    @Headers('svix-timestamp') svixTimestamp: string,
    @Headers('svix-signature') svixSignature: string,
    @Req() request: RawBodyRequest<Request>,
  ) {
    this.logger.log(`Received webhook - ID: ${svixId}`);
    this.logger.debug('Headers received:', {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    });
    
    try {
      if (!request.rawBody) {
        throw new Error('No raw body available');
      }

      const rawBody = request.rawBody.toString('utf8');
      this.logger.debug('Raw body:', rawBody);

      // Prepare headers as required by svix
      const svixHeaders = {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      } satisfies WebhookRequiredHeaders;
      
      // Verify webhook signature using svix
      const payload = this.wh.verify(rawBody, svixHeaders) as WebhookEvent;
      
      this.logger.debug('Webhook event:', payload);

      switch (payload.type) {
        case 'user.created':
        case 'user.updated':
          this.logger.log(`Processing ${payload.type} event for user ${payload.data.id}`);
          await this.userService.createUser({
            id: payload.data.id,
            email: payload.data.email_addresses[0]?.email_address,
            username: payload.data.username || payload.data.first_name || 'Anonymous',
          });
          this.logger.log(`Successfully processed ${payload.type} event for user ${payload.data.id}`);
          break;
        default:
          this.logger.log(`Unhandled event type: ${payload.type}`);
      }

      return { received: true };
    } catch (err) {
      this.logger.error('Error details:', {
        name: err.name,
        message: err.message,
        code: err.code,
        stack: err.stack,
      });
      
      if (err.code === 'ERR_INVALID_SIGNATURE' || err.message.includes('signature')) {
        throw new UnauthorizedException('Invalid webhook signature');
      }
      throw err;
    }
  }
} 