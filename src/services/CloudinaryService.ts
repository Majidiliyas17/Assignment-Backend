import { randomUUID } from 'crypto';
import { cloudinaryClient, isCloudinaryConfigured } from '../config/cloudinary';
import { CloudinaryResourceType } from '../enums';
import { AppError } from '../utils';
import { CloudinaryAssetInfo, SignedUploadParams } from '../dto/cloudinary';
import { env } from '../config/env';

export const CLOUDINARY_STORAGE_ROOT = 'file-storage';

const CHUNK_SIZE_BYTES = 20 * 1024 * 1024;
const LARGE_FILE_THRESHOLD_BYTES = 10 * 1024 * 1024;

function assertConfigured(): void {
  if (!isCloudinaryConfigured) {
    throw AppError.internal(
      'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.',
      'CLOUDINARY_NOT_CONFIGURED',
    );
  }
}

export class CloudinaryService {
  static generateStorageId(): string {
    return randomUUID();
  }

  static buildPublicId(userId: string, storageId: string): string {
    return `${CLOUDINARY_STORAGE_ROOT}/${userId}/${storageId}`;
  }

  static buildFolder(userId: string): string {
    return `${CLOUDINARY_STORAGE_ROOT}/${userId}`;
  }

  static generateSignedUploadParams(input: {
    userId: string;
    storageId: string;
    resourceType: CloudinaryResourceType;
    sizeBytes: number;
  }): SignedUploadParams {
    assertConfigured();

    const publicId = CloudinaryService.buildPublicId(input.userId, input.storageId);
    const timestamp = Math.floor(Date.now() / 1000);

    const paramsToSign: Record<string, string | number | boolean> = {
      timestamp,
      public_id: publicId,
    };

    if (input.sizeBytes >= LARGE_FILE_THRESHOLD_BYTES) {
      paramsToSign.chunk_size = CHUNK_SIZE_BYTES;
    }

    const signature = cloudinaryClient.utils.api_sign_request(paramsToSign, env.CLOUDINARY_API_SECRET!);

    return {
      signature,
      timestamp: String(timestamp),
      apiKey: env.CLOUDINARY_API_KEY!,
      cloudName: env.CLOUDINARY_CLOUD_NAME!,
      folder: CloudinaryService.buildFolder(input.userId),
      publicId,
      resourceType: input.resourceType,
    };
  }

  static async getAssetInfo(publicId: string, resourceType: CloudinaryResourceType): Promise<CloudinaryAssetInfo> {
    assertConfigured();

    try {
      const result = await cloudinaryClient.api.resource(publicId, {
        resource_type: CloudinaryService.toDestroyType(resourceType),
      });

      return {
        publicId: result.public_id,
        size: result.bytes,
        resourceType: result.resource_type,
        format: result.format,
        createdAt: result.created_at,
      };
    } catch {
      throw AppError.internal('Failed to verify asset on Cloudinary', 'CLOUDINARY_VERIFY_FAILED');
    }
  }

  static async deleteAsset(publicId: string, resourceType: CloudinaryResourceType): Promise<void> {
    assertConfigured();

    const result = await cloudinaryClient.uploader.destroy(publicId, {
      resource_type: CloudinaryService.toDestroyType(resourceType),
      invalidate: true,
    });

    if (result.result !== 'ok' && result.result !== 'not found') {
      throw AppError.badRequest('Failed to delete file from Cloudinary', 'CLOUDINARY_DELETE_FAILED', {
        result: result.result,
      });
    }
  }

  static getSecureUrl(publicId: string, resourceType: CloudinaryResourceType, format?: string): string {
    assertConfigured();

    // Cloudinary blocks normal public delivery of PDFs and ZIPs by default.
    // Raw files therefore use its short-lived authenticated download endpoint.
    if (resourceType === CloudinaryResourceType.RAW && format) {
      return cloudinaryClient.utils.private_download_url(publicId, format, {
        resource_type: CloudinaryResourceType.RAW,
        type: 'upload',
        attachment: true,
        expires_at: Math.floor(Date.now() / 1000) + 5 * 60,
      });
    }

    return cloudinaryClient.url(publicId, {
      secure: true,
      sign_url: true,
      resource_type: CloudinaryService.toDestroyType(resourceType),
    });
  }

  private static toDestroyType(resourceType: CloudinaryResourceType): string {
    return resourceType === CloudinaryResourceType.AUTO ? CloudinaryResourceType.RAW : resourceType;
  }
}
