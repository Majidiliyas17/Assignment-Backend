import { ALLOWED_EXTENSIONS, DANGEROUS_EXTENSIONS, getAllowedMimeTypes } from '../config/upload';
import { CloudinaryResourceType } from '../enums';
import { AppError } from './AppError';
import { MAX_FILE_SIZE_BYTES } from '../config/env';

export interface UploadMeta {
  originalName: string;
  extension: string;
  mimeType: string;
  size: number;
}

export function sanitizeFilename(input: string): string {
  const filename = input?.trim() ?? '';
  if (!filename) {
    throw AppError.badRequest('A filename is required', 'INVALID_FILENAME');
  }

  const basename = filename.includes('/') || filename.includes('\\') ? filename.split(/[\\/]/).pop()! : filename;

  const cleaned = basename
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned || cleaned === '.' || cleaned === '..' || cleaned === ' ' || cleaned === '...') {
    throw AppError.badRequest('Invalid filename', 'INVALID_FILENAME');
  }
  if (cleaned.length > 255) {
    throw AppError.badRequest('Filename must be at most 255 characters', 'INVALID_FILENAME');
  }

  return cleaned;
}

export function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  if (dot <= 0) {
    return '';
  }
  return filename.slice(dot + 1).toLowerCase();
}

export function validateAllowedExtension(extension: string): void {
  if (!extension) {
    throw AppError.badRequest('Filename must have an extension', 'INVALID_FILENAME');
  }
  if (DANGEROUS_EXTENSIONS.includes(extension) || !ALLOWED_EXTENSIONS.includes(extension)) {
    throw AppError.badRequest(`File type '.${extension}' is not allowed`, 'UNSUPPORTED_FILE_TYPE');
  }
}

export function validateMimeTypes(extension: string, mimeType: string): void {
  const mime = mimeType?.trim().toLowerCase() ?? '';
  if (!mime) {
    return;
  }
  if (mime === 'application/octet-stream') {
    return;
  }
  const allowed = getAllowedMimeTypes(extension);
  if (allowed.length > 0 && !allowed.includes(mime)) {
    throw AppError.badRequest(`MIME type '${mime}' does not match file extension '.${extension}'`, 'INVALID_MIME_TYPE');
  }
}

export function validateFileSize(size: number): void {
  if (!Number.isFinite(size) || size <= 0) {
    throw AppError.badRequest('A valid file size is required', 'INVALID_FILE_SIZE');
  }
  if (size > MAX_FILE_SIZE_BYTES) {
    throw AppError.payloadTooLarge(
      `File exceeds the maximum allowed size of ${Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024))} MB`,
      'FILE_TOO_LARGE',
    );
  }
}

export function validateAndNormalizeUploadMeta(input: {
  filename: string;
  mimeType?: string;
  size?: number;
}): UploadMeta {
  const originalName = sanitizeFilename(input.filename);
  const extension = getExtension(originalName);
  validateAllowedExtension(extension);

  const mimeType = input.mimeType?.trim().toLowerCase() ?? '';
  validateMimeTypes(extension, mimeType);

  if (input.size !== undefined) {
    validateFileSize(input.size);
  }

  return {
    originalName,
    extension,
    mimeType,
    size: input.size ?? 0,
  };
}

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
const VIDEO_EXTENSIONS = ['mp4'];

export function selectCloudinaryResourceType(extension: string): CloudinaryResourceType {
  if (IMAGE_EXTENSIONS.includes(extension)) {
    return CloudinaryResourceType.IMAGE;
  }
  if (VIDEO_EXTENSIONS.includes(extension)) {
    return CloudinaryResourceType.VIDEO;
  }
  return CloudinaryResourceType.RAW;
}