import { ApiProperty } from '@nestjs/swagger';

export class ThreadUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  imageUrl?: string | null;
}

export class ThreadReplyDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  content: string;

  @ApiProperty()
  threadId: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: ThreadUserDto })
  user: ThreadUserDto;
}

export class ThreadResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  channelId: string;

  @ApiProperty()
  parentMessage: {
    id: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    user: ThreadUserDto;
  };

  @ApiProperty({ type: [ThreadReplyDto] })
  replies: ThreadReplyDto[];

  @ApiProperty()
  replyCount: number;

  @ApiProperty({ required: false })
  lastReplyAt: Date | null;

  @ApiProperty()
  participantCount: number;
} 