import 'dotenv/config';
import { z } from 'zod';

const optionalString = (schema: z.ZodString) =>
  z.preprocess((value) => (value === undefined || value === '' ? undefined : value), schema.optional());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: optionalString(z.string().url()),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('1d'),
  CLOUDINARY_CLOUD_NAME: optionalString(z.string()),
  CLOUDINARY_API_KEY: optionalString(z.string()),
  CLOUDINARY_API_SECRET: optionalString(z.string()),
  MAX_FILE_SIZE_MB: z.coerce.number().int().positive().default(500),
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
}).safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const env = parsed.data;

export const MAX_FILE_SIZE_BYTES = env.MAX_FILE_SIZE_MB * 1024 * 1024;
export const IS_PRODUCTION = env.NODE_ENV === 'production';
export const IS_TEST = env.NODE_ENV === 'test';
export const IS_DEVELOPMENT = env.NODE_ENV === 'development';
