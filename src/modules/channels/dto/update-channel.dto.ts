import { MemberRole } from '../channel.types';

export interface UpdateChannelDto {
  channelId: string;
  name?: string;
  description?: string;
  memberRole?: {
    userId: string;
    role: MemberRole;
  };
} 