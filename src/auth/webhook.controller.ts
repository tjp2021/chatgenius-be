import { Controller, Post, Body, Headers, UnauthorizedException, Req, Logger } from '@nestjs/common';
import { UserService } from '../modules/users/user.service';
import { Webhook } from 'svix';
import { Request } from 'express';
import { WebhookEvent } from '@clerk/backend';

// Extend Express Request type to include rawBody
interface RequestWithRawBody extends Request {
  rawBody: Buffer;
}

@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);
  private wh: Webhook;

  constructor(private readonly userService: UserService) {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    this.logger.debug('Initializing webhook controller with secret:', {
      hasSecret: !!webhookSecret,
      secretPrefix: webhookSecret?.substring(0, 6),
    });
    
    if (!webhookSecret) {
      throw new Error('CLERK_WEBHOOK_SECRET environment variable is not set');
    }
    this.wh = new Webhook(webhookSecret);
  }

  private verifyWebhookSignature(payload: Buffer, headers: Record<string, string>): boolean {
    try {
      this.logger.debug('Verifying webhook signature with headers:', {
        svixId: headers['svix-id'],
        timestamp: headers['svix-timestamp'],
        hasSignature: !!headers['svix-signature'],
        payloadSize: payload?.length,
      });
      
      this.wh.verify(payload, headers);
      this.logger.debug('Webhook signature verification successful');
      return true;
    } catch (err) {
      this.logger.error('Webhook signature verification failed:', {
        error: err.message,
        headers,
        payloadSize: payload?.length,
      });
      return false;
    }
  }

  @Post('/clerk')
  async handleWebhook(
    @Headers('svix-id') svixId: string,
    @Headers('svix-timestamp') svixTimestamp: string,
    @Headers('svix-signature') svixSignature: string,
    @Req() request: RequestWithRawBody,
    @Body() evt: WebhookEvent
  ) {
    console.log('🚨 WEBHOOK RECEIVED:', {
      type: evt.type,
      userId: evt.data?.id,
      headers: {
        svixId,
        svixTimestamp,
        hasSignature: !!svixSignature
      }
    });

    this.logger.debug('Full webhook payload:', { 
      type: evt.type,
      data: JSON.stringify(evt.data, null, 2),
      headers: {
        svixId,
        svixTimestamp,
        signature: svixSignature?.substring(0, 32) + '...',
      }
    });

    // Verify webhook signature using raw body
    if (!this.verifyWebhookSignature(request.rawBody, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    })) {
      this.logger.error('❌ Invalid webhook signature', {
        svixId,
        timestamp: svixTimestamp,
        hasSignature: !!svixSignature,
      });
      throw new UnauthorizedException('Invalid webhook signature');
    }

    this.logger.debug('✅ Webhook signature verified');

    try {
      this.logger.debug('Processing webhook payload:', { 
        type: evt.type, 
        data: JSON.stringify(evt.data, null, 2),
      });

      switch (evt.type) {
        case 'user.created': {
          const userData = evt.data;
          
          this.logger.debug('Processing user.created webhook:', {
            userId: userData.id,
            firstName: userData.first_name,
            lastName: userData.last_name,
            emailAddresses: userData.email_addresses,
            imageUrl: userData.image_url
          });

          // Get primary email if it exists
          const primaryEmail = userData.email_addresses?.find(
            email => email.id === userData.primary_email_address_id
          );
          const email = primaryEmail?.email_address;

          this.logger.debug('Extracted email information:', {
            primaryEmailId: userData.primary_email_address_id,
            foundPrimaryEmail: !!primaryEmail,
            email
          });

          const firstName = userData.first_name || '';
          const lastName = userData.last_name || '';
          const name = firstName || lastName 
            ? `${firstName} ${lastName}`.trim()
            : email?.split('@')[0] || 'Anonymous';

          const imageUrl = userData.image_url;

          const createUserData = {
            id: userData.id,
            email: email || undefined,
            name,
            imageUrl,
          };

          this.logger.debug('About to create user with data:', createUserData);

          try {
            const createdUser = await this.userService.createUser(createUserData);
            this.logger.debug('User created successfully:', { 
              userId: createdUser.id,
              email: createdUser.email,
              name: createdUser.name
            });
          } catch (error) {
            this.logger.error('Failed to create user:', {
              error: error.message,
              stack: error.stack,
              data: createUserData
            });
            throw error;
          }
          break;
        }

        case 'user.updated': {
          const userData = evt.data;
          const primaryEmail = userData.email_addresses?.find(email => email.id === userData.primary_email_address_id);
          const email = primaryEmail?.email_address;
          
          const firstName = userData.first_name || '';
          const lastName = userData.last_name || '';
          const name = firstName || lastName 
            ? `${firstName} ${lastName}`.trim()
            : undefined;

          const imageUrl = userData.image_url;

          await this.userService.updateUser(userData.id, {
            name,
            imageUrl,
          });
          this.logger.debug('User updated successfully', { 
            userId: userData.id,
            name,
          });
          break;
        }

        case 'user.deleted': {
          await this.userService.deleteUser(evt.data.id);
          this.logger.debug('User deleted successfully', { userId: evt.data.id });
          break;
        }

        case 'session.created': {
          await this.userService.updateUserStatus(evt.data.user_id, 'online');
          this.logger.debug('User status updated to online', { userId: evt.data.user_id });
          break;
        }

        case 'session.ended': {
          await this.userService.updateUserStatus(evt.data.user_id, 'offline');
          this.logger.debug('User status updated to offline', { userId: evt.data.user_id });
          break;
        }

        default: {
          this.logger.warn('Unhandled webhook event type:', evt.type);
        }
      }

      return { success: true };
    } catch (error) {
      this.logger.error('Error handling Clerk webhook:', {
        error: error.message,
        stack: error.stack,
        type: evt?.type,
        userId: evt?.data?.id,
      });
      throw error;
    }
  }
} 