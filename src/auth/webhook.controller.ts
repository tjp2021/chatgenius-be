import { Controller, Post, Headers, HttpCode, UnauthorizedException, Logger, RawBodyRequest, Req } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { WebhookEvent } from '@clerk/clerk-sdk-node';
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
        this.logger.error('No raw body available in request');
        throw new Error('No raw body available');
      }

      const rawBody = request.rawBody.toString('utf8');
      this.logger.debug('Raw body:', rawBody);
      
      // Log request properties
      this.logger.debug('Request properties:', {
        method: request.method,
        contentType: request.headers['content-type'],
        contentLength: request.headers['content-length'],
        bodyType: typeof request.body,
        rawBodyType: typeof request.rawBody,
        rawBodyLength: request.rawBody.length,
      });

      // Prepare headers as required by svix
      const svixHeaders = {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      } satisfies WebhookRequiredHeaders;

      this.logger.debug('Attempting to verify webhook with svix...', {
        headerKeys: Object.keys(svixHeaders),
        timestampType: typeof svixTimestamp,
        timestampValue: svixTimestamp,
      });
      
      let payload: WebhookEvent;
      try {
        // Verify webhook signature using svix
        payload = this.wh.verify(rawBody, svixHeaders) as WebhookEvent;
        this.logger.log(`Successfully verified webhook. Processing ${payload.type} event for user ${payload.data.id}`);
      } catch (verifyError) {
        this.logger.error('Verification failed:', {
          error: verifyError.message,
          code: verifyError.code,
          name: verifyError.name,
        });
        throw verifyError;
      }

      switch (payload.type) {
        case 'user.created':
        case 'user.updated': {
          const primaryEmail = payload.data.email_addresses?.find(email => email.id === payload.data.primary_email_address_id);
          const imageUrl = payload.data.image_url;
          
          await this.userService.createUser({
            id: payload.data.id,
            email: primaryEmail?.email_address,
            username: payload.data.username || 
                     `${payload.data.first_name || ''} ${payload.data.last_name || ''}`.trim() || 
                     'Anonymous',
            imageUrl,
          });
          this.logger.log(`Successfully processed user data for ${payload.data.id}`);
          break;
        }
        
        case 'user.deleted': {
          await this.userService.deleteUser(payload.data.id);
          this.logger.log(`Successfully processed deletion for user ${payload.data.id}`);
          break;
        }

        case 'session.created': {
          await this.userService.updateUserOnlineStatus(payload.data.user_id, true);
          this.logger.log(`Updated online status to true for user ${payload.data.user_id}`);
          break;
        }

        case 'session.ended': {
          await this.userService.updateUserOnlineStatus(payload.data.user_id, false);
          this.logger.log(`Updated online status to false for user ${payload.data.user_id}`);
          break;
        }

        default:
          this.logger.log(`Unhandled event type: ${payload.type}`);
      }

      return { received: true, event: payload.type };
    } catch (err) {
      this.logger.error('Error processing webhook:', {
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