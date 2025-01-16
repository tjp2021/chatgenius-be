import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class AiTestRequestDto {
  channelId: string;
}

export class AiTestResponseDto {
  status: string;
  message: string;
  channelId: string;
}

export class AiSynthesisRequestDto {
  channelId: string;
  prompt: string;
}

export class AnalyzeChannelRequestDto {
  @IsString()
  @IsNotEmpty()
  channelId: string;
}

export class AnalyzeChannelResponseDto {
  channelId: string;
  channelName: string;
  messageCount: number;
  memberCount: number;
  analysis: string;
  analyzedAt: Date;
}

export class UserStyleAnalysisRequestDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class UserStyleAnalysisResponseDto {
  userId: string;
  messageCount: number;
  styleAnalysis: string;
  analyzedAt: Date;
}

export class ExtractDocumentRequestDto {
  @IsString()
  @IsNotEmpty()
  fileId: string;
}

export class ExtractDocumentResponseDto {
  content: string;
  fileType: string;
  extractedAt: Date;
}

export class CreateAvatarRequestDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class AvatarAnalysisDto {
  id: string;
  userId: string;
  messageAnalysis: {
    timestamp: Date;
    lastMessageId: string;
    analysis: {
      tone: string;
      vocabulary: string;
      messageLength: string;
      commonPhrases: string[];
      confidence: number;
    };
  };
  updatedAt: Date;
}

export class GenerateAvatarResponseDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  prompt: string;
}

export class SearchMessagesRequestDto {
  @IsString()
  @IsNotEmpty()
  query: string;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  channelId?: string;

  @IsNumber()
  @IsOptional()
  limit?: number;
}

export class SearchMessagesResponseDto {
  id: string;
  content: string;
  userId: string;
  channelId: string;
  createdAt: Date;
} 