import { UserEntity } from '../entities';

declare global {
  namespace Express {
    interface Request {
      user: UserEntity;
    }
  }
}

export {};