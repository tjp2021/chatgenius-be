import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { clerkClient } from '@clerk/clerk-sdk-node';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'CLERK_INIT',
      useFactory: async (configService: ConfigService) => {
        const secretKey = configService.get<string>('CLERK_SECRET_KEY');
        if (!secretKey) {
          throw new Error('CLERK_SECRET_KEY is not defined in environment variables');
        }
        process.env.CLERK_SECRET_KEY = secretKey;
        return true;
      },
      inject: [ConfigService],
    },
  ],
})
export class ClerkModule {} 