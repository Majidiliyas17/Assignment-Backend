import { AppDataSource } from '../../src/config/database';

export async function initTestDatabase(): Promise<void> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  await AppDataSource.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
}