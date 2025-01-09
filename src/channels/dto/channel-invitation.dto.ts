import { IsString, IsUUID, IsEnum, IsOptional } from 'class-validator';
import { MemberRole } from '@prisma/client';

export class CreateChannelInvitationDto {
  @IsUUID()
  userId: string;

  @IsEnum(MemberRole)
  @IsOptional()
  role?: MemberRole = MemberRole.MEMBER;
}

export class ChannelInvitationResponseDto {
  success: boolean;
  channelId: string;
  userId: string;
  role: MemberRole;
}

export class AcceptChannelInvitationDto {
  @IsUUID()
  invitationId: string;
}

export class RejectChannelInvitationDto {
  @IsUUID()
  invitationId: string;
} 