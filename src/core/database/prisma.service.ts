import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(private configService: ConfigService) {
    super({
      datasources: {
        db: {
          url: configService.get('DATABASE_URL'),
        },
      },
      log: ['error', 'warn'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async cleanDatabase() {
    if (this.configService.get('NODE_ENV') === 'production') {
      return;
    }
    
    const models = Reflect.ownKeys(this).filter(
      (key) => typeof key === 'string' && 
               key[0] !== '_' && 
               typeof this[key as keyof this] === 'object'
    );
    
    return Promise.all(
      models.map((modelKey) => {
        const model = this[modelKey as keyof this];
        return typeof model === 'object' && model?.deleteMany?.();
      })
    );
  }
} 