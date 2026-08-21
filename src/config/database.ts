import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { env, IS_PRODUCTION } from './env';

const requiresSsl = Boolean(env.DATABASE_URL?.includes('neon.tech')) || IS_PRODUCTION;

export interface DatabaseIdentity {
  host: string;
  name: string;
}

/** Returns only non-secret database identity fields for validation and logs. */
export const getDatabaseIdentity = (): DatabaseIdentity | undefined => {
  if (!env.DATABASE_URL) return undefined;

  const url = new URL(env.DATABASE_URL);
  return { host: url.hostname.toLowerCase(), name: decodeURIComponent(url.pathname.replace(/^\//, '')) };
};

export const assertExpectedProductionDatabase = (): DatabaseIdentity | undefined => {
  const identity = getDatabaseIdentity();
  if (!IS_PRODUCTION || !identity) return identity;

  if (
    identity.host !== env.DATABASE_EXPECTED_HOST!.toLowerCase() ||
    identity.name !== env.DATABASE_EXPECTED_NAME
  ) {
    throw new Error('Configured DATABASE_URL does not match DATABASE_EXPECTED_HOST/DATABASE_EXPECTED_NAME');
  }
  return identity;
};

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: env.DATABASE_URL,
  synchronize: false,
  dropSchema: false,
  migrationsRun: false,
  migrationsTransactionMode: 'each',
  logging: env.NODE_ENV === 'development',
  entities: [`${__dirname}/../entities/**/*.{ts,js}`],
  migrations: [`${__dirname}/../migrations/**/*.{ts,js}`],
  subscribers: [],
  connectTimeoutMS: 10000,
  ...(requiresSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});

export type MigrationStatus = 'current' | 'pending' | 'missing';

/** Read-only migration inspection; it never creates, drops, or alters schema. */
export const getMigrationStatus = async (): Promise<{ status: MigrationStatus; applied: number; total: number }> => {
  const table = await AppDataSource.query<{ exists: boolean }[]>(
    "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'migrations') AS exists",
  );
  if (!table[0]?.exists) return { status: 'missing', applied: 0, total: AppDataSource.migrations.length };

  const applied = await AppDataSource.query<{ name: string }[]>('SELECT name FROM migrations');
  const appliedNames = new Set(applied.map((migration) => migration.name));
  const pending = AppDataSource.migrations.some((migration) => !appliedNames.has(migration.name ?? migration.constructor.name));
  return { status: pending ? 'pending' : 'current', applied: applied.length, total: AppDataSource.migrations.length };
};
