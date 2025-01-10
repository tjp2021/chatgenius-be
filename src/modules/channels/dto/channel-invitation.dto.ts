import { MemberRole } from '../../../shared/types/prisma.types';

export class CreateChannelInvitationDto {
  inviteeId: string;
}

export interface ChannelInvitationResponseDto {
  success: boolean;
  userId: string;
  role: MemberRole;
  channel: {
    id: string;
    name: string;
    description?: string;
    type: string;
    createdAt: Date;
    updatedAt: Date;
    lastActivityAt: Date;
    memberCount: number;
  };
  inviter: {
    id: string;
    name: string;
    imageUrl?: string;
  };
}

export interface AcceptChannelInvitationDto {
  invitationId: string;
}

export interface RejectChannelInvitationDto {
  invitationId: string;
} 