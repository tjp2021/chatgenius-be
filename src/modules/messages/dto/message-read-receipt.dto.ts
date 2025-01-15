export interface MessageReadReceiptDto {
  id: string;
  messageId: string;
  userId: string;
  readAt: Date;
  user: {
    id: string;
    name: string | null;
    imageUrl: string | null;
  };
}

export interface CreateMessageReadReceiptDto {
  messageId: string;
} 