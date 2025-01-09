export class MessageReadReceiptDto {
  messageId: string;
  channelId: string;
  userId: string;
  readAt: Date;
  user: {
    id: string;
    name: string | null;
    imageUrl: string | null;
  };
}

export class MessageReadStatusDto {
  readBy: {
    userId: string;
    readAt: Date;
    user: {
      id: string;
      name: string | null;
      imageUrl: string | null;
    };
  }[];
  readCount: number;
  totalMembers: number;
} 