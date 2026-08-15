import bcrypt from 'bcryptjs';
import { userRepository } from '../repositories';
import { UserEntity } from '../entities';
import { AppError } from '../utils';
import { TokenUtils } from '../utils';
import { AuthResult, SafeUser } from '../dto/auth';

const BCRYPT_ROUNDS = 12;

export class AuthService {
  static async register(input: { name: string; email: string; password: string }): Promise<AuthResult> {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      throw AppError.conflict('An account with this email already exists', 'EMAIL_ALREADY_REGISTERED');
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const user = await userRepository.create({
      name: input.name,
      email: input.email,
      passwordHash,
    });

    return {
      user: AuthService.serialize(user),
      accessToken: TokenUtils.signAccessToken(user.id),
    };
  }

  static async login(input: { email: string; password: string }): Promise<AuthResult> {
    const user = await userRepository.findByEmailWithPassword(input.email);
    if (!user) {
      throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isPasswordValid) {
      throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    return {
      user: AuthService.serialize(user),
      accessToken: TokenUtils.signAccessToken(user.id),
    };
  }

  static async getCurrentUser(userId: string): Promise<SafeUser> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw AppError.unauthorized('User no longer exists', 'USER_NOT_FOUND');
    }
    return AuthService.serialize(user);
  }

  static serialize(user: UserEntity): SafeUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    };
  }
}