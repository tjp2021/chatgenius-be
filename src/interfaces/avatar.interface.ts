export interface StyleAnalysis {
  tone: string;
  vocabulary: string;
  messageLength: string;
  commonPhrases: string[];
  confidence: number;
}

export interface MessageAnalysis {
  timestamp: Date;
  lastMessageId: string;
  analysis: StyleAnalysis;
}

export interface AvatarAnalysisData {
  messageAnalysis: MessageAnalysis;
}

export interface AvatarAnalysis {
  id: string;
  userId: string;
  messageAnalysis: MessageAnalysis;
  updatedAt: Date;
}

export interface IAvatarService {
  createAvatar(userId: string): Promise<AvatarAnalysis>;
  generateResponse(userId: string, prompt: string): Promise<string>;
  updateAvatar(userId: string): Promise<AvatarAnalysis>;
} 