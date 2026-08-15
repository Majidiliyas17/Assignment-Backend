import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { env, IS_PRODUCTION } from './env';

const requiresSsl = Boolean(env.DATABASE_URL?.includes('neon.tech')) || IS_PRODUCTION;

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: env.DATABASE_URL,
  synchronize: false,
  logging: env.NODE_ENV === 'development',
  entities: [`${__dirname}/../entities/**/*.{ts,js}`],
  migrations: [`${__dirname}/../migrations/**/*.{ts,js}`],
  subscribers: [],
  connectTimeoutMS: 10000,
  ...(requiresSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});