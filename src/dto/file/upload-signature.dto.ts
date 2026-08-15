import { z } from 'zod';

export const uploadSignatureSchema = z.object({
  filename: z.string().min(1, 'Filename is required').max(255, 'Filename must be at most 255 characters'),
  mimeType: z.string().min(1).max(255).optional(),
  size: z.number().int().positive('File size must be a positive integer'),
});

export type UploadSignatureInput = z.infer<typeof uploadSignatureSchema>;
