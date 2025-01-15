export interface MessageReadStatusDto {
  readBy: {
    userId: string;
    readAt: Date;
    user: {
      id: string;
      name: string;
      imageUrl: string;
    };
  }[];
  readCount: number;
  totalMembers: number;
} 