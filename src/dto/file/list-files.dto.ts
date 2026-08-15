import { z } from 'zod';

export const listFilesSchema = z.object({
  page: z.coerce.number().int().min(1, 'page must be at least 1').default(1),
  limit: z.coerce.number().int().min(1, 'limit must be at least 1').max(100, 'limit must be at most 100').default(20),
});

export type ListFilesInput = z.infer<typeof listFilesSchema>;
