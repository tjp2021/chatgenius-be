export interface SynthesisResponse {
  response: string;
  contextMessageCount: number;
}

export interface SynthesisOptions {
  channelId: string;
  prompt: string;
} 