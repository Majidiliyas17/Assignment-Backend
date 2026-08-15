import { z } from 'zod';

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters long')
    .max(120, 'Name must be at most 120 characters long'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('A valid email address is required')
    .max(255, 'Email must be at most 255 characters long'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .max(72, 'Password must be at most 72 characters long')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
