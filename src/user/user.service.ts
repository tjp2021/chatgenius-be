import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async createUser(data: { id: string; email: string; username: string }) {
    return this.prisma.user.upsert({
      where: {
        id: data.id
      },
      create: {
        id: data.id,
        email: data.email,
        name: data.username,
      },
      update: {
        email: data.email,
        name: data.username,
      }
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async getUser(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async updateUser(id: string, data: { name?: string; imageUrl?: string }) {
    return this.prisma.user.update({
      where: { id },
      data: {
        name: data.name,
        imageUrl: data.imageUrl,
      },
    });
  }
} 