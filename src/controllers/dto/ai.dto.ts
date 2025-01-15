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