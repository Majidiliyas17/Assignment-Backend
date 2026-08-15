import { UserEntity } from '../entities/UserEntity';
import { BaseRepository } from './BaseRepository';

export class UserRepository extends BaseRepository<UserEntity> {
  constructor() {
    super(UserEntity);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.findOne({ email });
  }

  async findByEmailWithPassword(email: string): Promise<UserEntity | null> {
    return this.repo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();
  }
}

export const userRepository = new UserRepository();
