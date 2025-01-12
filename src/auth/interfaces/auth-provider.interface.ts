import { TokenValidationResponse } from '../types/auth.types';

export interface IAuthProvider {
  validateToken(token: string): Promise<TokenValidationResponse>;
  refreshToken(token: string): Promise<string>;
  revokeToken(token: string): Promise<void>;
  verifySession(sessionId: string, token: string): Promise<{
    userId: string;
    expiresAt: number;
  }>;
} 