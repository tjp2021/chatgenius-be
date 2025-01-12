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

  async searchUsers(query: string, currentUserId: string) {
    console.log('Searching users with query:', query);
    console.log('Current user ID to exclude:', currentUserId);
    
    if (!query?.trim()) {
      console.log('Empty query, returning empty array');
      return [];
    }

    // First get all users to verify data
    const allUsers = await this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
      }
    });
    console.log('All users in database:', JSON.stringify(allUsers, null, 2));

    // Normalize the search query
    const normalizedQuery = query.trim().toLowerCase();
    console.log('Normalized query:', normalizedQuery);

    const results = await this.prisma.user.findMany({
      where: {
        AND: [
          {
            OR: [
              { 
                name: { 
                  contains: normalizedQuery,
                  mode: 'insensitive'
                } 
              },
              { 
                email: { 
                  contains: normalizedQuery,
                  mode: 'insensitive'
                } 
              }
            ]
          },
          {
            id: {
              not: currentUserId
            }
          }
        ]
      },
      select: {
        id: true,
        name: true,
        email: true,
        imageUrl: true,
        isOnline: true
      }
    });

    console.log('Current user ID that was excluded:', currentUserId);
    console.log('Search results:', JSON.stringify(results, null, 2));
    return results;
  }
} 