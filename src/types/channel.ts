export type ChannelType = 'PUBLIC' | 'PRIVATE' | 'DM';
export type MemberRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface ChannelMember {
  userId: string;
  role: MemberRole;
  joinedAt: Date;
}

export interface Channel {
  id: string;
  name: string;
  description?: string;
  type: ChannelType;
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
  members: ChannelMember[];
  memberCount: number;
  lastMessageAt?: Date;
} 