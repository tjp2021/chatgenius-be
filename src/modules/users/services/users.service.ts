import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../lib/prisma.service';
import { SyncUserDto } from '../dto/sync-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async syncUser(syncUserDto: SyncUserDto) {
    const name = [syncUserDto.firstName, syncUserDto.lastName]
      .filter(Boolean)
      .join(' ');

    return this.prisma.user.upsert({
      where: { id: syncUserDto.id },
      update: {
        email: syncUserDto.email,
        name,
        imageUrl: syncUserDto.imageUrl
      },
      create: {
        id: syncUserDto.id,
        email: syncUserDto.email,
        name,
        imageUrl: syncUserDto.imageUrl
      }
    });
  }

  async getUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId }
    });
  }
} 