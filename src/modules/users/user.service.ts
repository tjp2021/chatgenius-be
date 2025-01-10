import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { EventService } from '../../core/events/event.service';
import { User } from '../../core/events/event.types';
import { Prisma } from '@prisma/client';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

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
    try {
      this.logger.log('Starting user creation/update:', {
        id: data.id,
        email: data.email,
        name: data.name,
        hasImage: !!data.imageUrl
      });

      // Validate required fields
      if (!data.id) {
        throw new BadRequestException('User ID is required');
      }

      // Check if user already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { id: data.id }
      });

      this.logger.debug('Existing user check:', {
        exists: !!existingUser,
        userId: data.id
      });

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
          updatedAt: new Date(),
        }
      });

      this.logger.log('User created/updated successfully:', {
        id: user.id,
        email: user.email,
        name: user.name,
        operation: existingUser ? 'updated' : 'created'
      });

      // Emit user created/updated event
      this.events.emitToUser(user.id, existingUser ? 'user.updated' : 'user.created', user);

      return user;
    } catch (error) {
      this.logger.error('Error in createUser:', {
        error: error.message,
        code: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined,
        meta: error instanceof Prisma.PrismaClientKnownRequestError ? error.meta : undefined,
        stack: error.stack,
        data
      });
      throw error;
    }
  }

  async findById(id: string): Promise<User | null> {
    try {
      this.logger.debug('Finding user by ID:', { id });
      
      if (!id) {
        throw new BadRequestException('User ID is required');
      }
      
      const user = await this.prisma.user.findUnique({
        where: { id },
      });

      this.logger.debug('Find user result:', {
        id,
        found: !!user
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      return user;
    } catch (error) {
      this.logger.error('Error finding user:', {
        error: error.message,
        userId: id,
        stack: error.stack
      });
      throw error;
    }
  }

  async updateUser(id: string, data: { 
    name?: string; 
    imageUrl?: string;
  }): Promise<User> {
    try {
      this.logger.debug('Updating user:', { id, data });

      const user = await this.prisma.user.update({
        where: { id },
        data: {
          name: data.name,
          imageUrl: data.imageUrl,
          updatedAt: new Date(),
        },
      });

      this.logger.log('User updated successfully:', {
        id: user.id,
        name: user.name,
        hasImage: !!user.imageUrl
      });

      // Emit user updated event
      this.events.emitToUser(user.id, 'user.updated', user);

      return user;
    } catch (error) {
      this.logger.error('Error updating user:', {
        error: error.message,
        userId: id,
        data,
        stack: error.stack
      });
      throw error;
    }
  }

  async updateUserStatus(id: string, status: 'online' | 'offline' | 'away'): Promise<void> {
    try {
      this.logger.debug('Updating user status:', { id, status });

      const user = await this.prisma.user.update({
        where: { id },
        data: {
          isOnline: status === 'online',
          lastSeen: new Date(),
        },
      });

      this.logger.debug('User status updated:', {
        id: user.id,
        status,
        lastSeen: user.lastSeen
      });

      // Emit user status changed event
      this.events.emitToUser(user.id, 'user.status_changed', {
        userId: user.id,
        status,
        lastSeen: user.lastSeen,
      });
    } catch (error) {
      this.logger.error('Error updating user status:', {
        error: error.message,
        userId: id,
        status,
        stack: error.stack
      });
      throw error;
    }
  }

  async deleteUser(id: string): Promise<void> {
    try {
      this.logger.debug('Deleting user:', { id });

      const user = await this.findById(id);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      await this.prisma.user.delete({
        where: { id },
      });

      this.logger.log('User deleted successfully:', { id });

      // Emit user deleted event
      this.events.emitToUser(id, 'user.deleted', { id });
    } catch (error) {
      this.logger.error('Error deleting user:', {
        error: error.message,
        userId: id,
        stack: error.stack
      });
      throw error;
    }
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