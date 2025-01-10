import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { EventService } from '../../core/events/event.service';
import { User } from '../../core/events/event.types';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private events: EventService,
  ) {}

  async createUser(data: { 
    id: string; 
    email: string; 
    name: string; 
    imageUrl?: string;
  }): Promise<User> {
    const user = await this.prisma.user.upsert({
      where: {
        id: data.id
      },
      create: {
        id: data.id,
        email: data.email,
        name: data.name,
        imageUrl: data.imageUrl,
        isOnline: true,
        lastSeen: new Date(),
      },
      update: {
        email: data.email,
        name: data.name,
        imageUrl: data.imageUrl,
      }
    });

    // Emit user created/updated event
    this.events.emitToUser(user.id, 'user.created', user);

    return user;
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async updateUser(id: string, data: { 
    name?: string; 
    imageUrl?: string;
  }): Promise<User> {
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        name: data.name,
        imageUrl: data.imageUrl,
        updatedAt: new Date(),
      },
    });

    // Emit user updated event
    this.events.emitToUser(user.id, 'user.updated', user);

    return user;
  }

  async updateUserStatus(id: string, status: 'online' | 'offline' | 'away'): Promise<void> {
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        isOnline: status === 'online',
        lastSeen: new Date(),
      },
    });

    // Emit user status changed event
    this.events.emitToUser(user.id, 'user.status_changed', {
      userId: user.id,
      status,
      lastSeen: user.lastSeen,
    });
  }

  async deleteUser(id: string): Promise<void> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.delete({
      where: { id },
    });

    // Emit user deleted event
    this.events.emitToUser(id, 'user.deleted', { id });
  }

  async setTyping(userId: string, channelId: string, isTyping: boolean): Promise<void> {
    if (isTyping) {
      this.events.emit(channelId, 'user.typing', {
        userId,
        channelId,
        timestamp: new Date(),
      });
    }
  }

  async getUserChannels(userId: string): Promise<string[]> {
    const channels = await this.prisma.channelMember.findMany({
      where: { userId },
      select: { channelId: true },
    });

    return channels.map(c => c.channelId);
  }
} 