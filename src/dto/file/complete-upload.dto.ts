import { z } from 'zod';
import { CloudinaryResourceType } from '../../enums';

export const completeUploadSchema = z.object({
  publicId: z.string().min(1).max(500, 'publicId must be at most 500 characters'),
  originalName: z.string().min(1).max(255, 'Filename must be at most 255 characters'),
  resourceType: z.nativeEnum(CloudinaryResourceType).optional(),
  mimeType: z.string().min(1).max(255).optional(),
  size: z.number().int().positive().optional(),
});

export type CompleteUploadInput = z.infer<typeof completeUploadSchema>;
