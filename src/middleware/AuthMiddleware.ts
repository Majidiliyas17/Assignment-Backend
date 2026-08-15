import { NextFunction, Request, Response } from 'express';
import { userRepository } from '../repositories';
import { AppError } from '../utils';
import { TokenUtils } from '../utils';

export class AuthMiddleware {
  static async authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw AppError.unauthorized(
          'Authentication required. Provide a valid Bearer token in the Authorization header',
          'TOKEN_MISSING',
        );
      }

      const token = authHeader.slice('Bearer '.length).trim();
      const payload = TokenUtils.verifyAccessToken(token);

      const user = await userRepository.findById(payload.sub);
      if (!user) {
        throw AppError.unauthorized('The user associated with this token no longer exists', 'USER_NOT_FOUND');
      }

      req.user = user;
      next();
    } catch (err) {
      next(err);
    }
  }
}