export interface ConversationAnalysis {
  patterns: {
    messageFrequency: string;
    peakActivityTimes: string[];
    dominantSpeakers: string[];
  };
  topics: {
    mainThemes: string[];
    keywordFrequency: Record<string, number>;
  };
  engagement: {
    activeUsers: string[];
    reactionPatterns: Record<string, number>;
    participationScore: number;
  };
} 