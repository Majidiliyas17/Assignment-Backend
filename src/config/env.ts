import 'dotenv/config';
import { z } from 'zod';

const optionalString = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (value === undefined || value === '' ? undefined : value), schema.optional());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: optionalString(z.string().url()),
  // These values never contain credentials. They prevent a production release
  // from silently being pointed at a preview/development database.
  DATABASE_ENVIRONMENT: optionalString(z.enum(['development', 'preview', 'production', 'test'])),
  DATABASE_EXPECTED_HOST: optionalString(z.string().min(1)),
  DATABASE_EXPECTED_NAME: optionalString(z.string().min(1)),
  JWT_SECRET: z.string().min(16),
  JWT_SECRET_VERSION: z.string().min(1).default('unversioned'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
  REQUIRE_MIGRATIONS_CURRENT: z.coerce.boolean().default(true),
  CLOUDINARY_CLOUD_NAME: optionalString(z.string()),
  CLOUDINARY_API_KEY: optionalString(z.string()),
  CLOUDINARY_API_SECRET: optionalString(z.string()),
  MAX_FILE_SIZE_MB: z.coerce.number().int().positive().default(500),
  STORAGE_QUOTA_MB: z.coerce.number().int().positive().default(500),
  ALLOWED_EXTENSIONS: optionalString(z.string()),
  APP_BASE_URL: z.string().default('http://localhost:4000'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
});

const parsed = envSchema.superRefine((data, context) => {
  if (data.NODE_ENV === 'production' && (data.JWT_SECRET?.length ?? 0) < 32) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['JWT_SECRET'],
      message: 'JWT_SECRET must be at least 32 characters long in production',
    });
  }

  if (data.NODE_ENV === 'production') {
    if (!data.DATABASE_URL) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['DATABASE_URL'], message: 'DATABASE_URL is required in production' });
    }
    if (data.DATABASE_ENVIRONMENT !== 'production') {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['DATABASE_ENVIRONMENT'], message: 'DATABASE_ENVIRONMENT must be production in production' });
    }
    if (!data.DATABASE_EXPECTED_HOST) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['DATABASE_EXPECTED_HOST'], message: 'DATABASE_EXPECTED_HOST is required in production' });
    }
    if (!data.DATABASE_EXPECTED_NAME) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['DATABASE_EXPECTED_NAME'], message: 'DATABASE_EXPECTED_NAME is required in production' });
    }
  }
}).safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const env = parsed.data;

export const MAX_FILE_SIZE_BYTES = env.MAX_FILE_SIZE_MB * 1024 * 1024;
export const DEFAULT_STORAGE_QUOTA_BYTES = env.STORAGE_QUOTA_MB * 1024 * 1024;
export const IS_PRODUCTION = env.NODE_ENV === 'production';
export const IS_TEST = env.NODE_ENV === 'test';
export const IS_DEVELOPMENT = env.NODE_ENV === 'development';
