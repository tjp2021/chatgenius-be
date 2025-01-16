export interface AvatarAnalysisData {
  messageAnalysis: {
    timestamp: Date;
    lastMessageId: string;
    analysis: string;
  };
}

export interface AvatarAnalysis {
  id: string;
  userId: string;
  messageAnalysis: {
    timestamp: Date;
    lastMessageId: string;
    analysis: string;
  };
  documentAnalysis?: {
    timestamp: Date;
    lastFileId: string;
    analysis: string;
  };
  updatedAt: Date;
}

export interface AvatarUpdateOptions {
  userId: string;
  lastMessageId?: string;
  lastFileId?: string;
} 