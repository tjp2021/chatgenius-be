import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: ['error', 'warn', 'info'],
    });
    this.logger.log('PrismaService initialized');
  }

  async onModuleInit() {
    try {
      this.logger.log('Connecting to database...');
      await this.$connect();
      this.logger.log('Successfully connected to database');
    } catch (error) {
      this.logger.error('Failed to connect to database:', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      this.logger.log('Disconnecting from database...');
      await this.$disconnect();
      this.logger.log('Successfully disconnected from database');
    } catch (error) {
      this.logger.error('Error disconnecting from database:', {
        error: error.message,
        stack: error.stack,
      });
    }
  }

  async cleanDatabase() {
    const models = Reflect.ownKeys(this).filter(key => {
      const value = this[key as keyof this];
      return typeof value === 'object' && value !== null && 'deleteMany' in value;
    });

    return Promise.all(
      models.map(async modelKey => {
        const model = this[modelKey as keyof this];
        if (typeof model === 'object' && model !== null && 'deleteMany' in model) {
          return (model as any).deleteMany();
        }
      })
    );
  }
} 