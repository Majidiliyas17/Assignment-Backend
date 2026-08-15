import { z } from 'zod';

export const visibilitySchema = z.object({
  visibility: z.enum(['public', 'private']),
});

export type VisibilityInput = z.infer<typeof visibilitySchema>;
