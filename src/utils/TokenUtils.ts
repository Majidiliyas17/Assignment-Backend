import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from './AppError';

export interface AccessTokenPayload {
  sub: string;
  iat?: number;
  exp?: number;
}

export class TokenUtils {
  static signAccessToken(userId: string): string {
    return jwt.sign({ sub: userId }, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
    });
  }

  static verifyAccessToken(token: string): AccessTokenPayload {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
      if (!payload.sub) {
        throw new Error('Token payload is missing subject');
      }
      return payload;
    } catch {
      throw AppError.unauthorized('Invalid or expired token', 'INVALID_TOKEN');
    }
  }
}