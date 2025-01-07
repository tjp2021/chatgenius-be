export interface JwtPayload {
  sub: string;
  exp?: number;
  [key: string]: any;
}

export interface ValidatedUser {
  id: string;
  sub: string;
}

export interface TokenValidationResponse {
  isValid: boolean;
  user: ValidatedUser;
} 