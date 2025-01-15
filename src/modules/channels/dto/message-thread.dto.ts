import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateThreadReplyDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsNotEmpty()
  parentId: string;
}

export class ThreadResponseDto {
  parentMessage: {
    id: string;
    content: string;
    createdAt: Date;
    user: {
      id: string;
      name: string | null;
      imageUrl: string | null;
    };
  };
  replies: {
    id: string;
    content: string;
    createdAt: Date;
    user: {
      id: string;
      name: string | null;
      imageUrl: string | null;
    };
    parentId: string;
    replyCount: number;
  }[];
  participantCount: number;
  lastReplyAt: Date | null;
} 