import { AvatarAnalysis } from './avatar.interface';

export interface IAvatarService {
  createAvatar(userId: string): Promise<AvatarAnalysis>;
  generateResponse(userId: string, prompt: string): Promise<string>;
  updateAvatar(userId: string): Promise<AvatarAnalysis>;
} 