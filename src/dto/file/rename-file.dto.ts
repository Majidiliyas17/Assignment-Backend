import { z } from 'zod';

export const renameFileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name must be at most 255 characters'),
});

export type RenameFileInput = z.infer<typeof renameFileSchema>;
