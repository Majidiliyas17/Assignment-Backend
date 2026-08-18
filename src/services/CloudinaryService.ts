import { randomUUID } from 'crypto';
import { cloudinaryClient, isCloudinaryConfigured } from '../config/cloudinary';
import { CloudinaryResourceType } from '../enums';
import { AppError } from '../utils';
import { CloudinaryAssetInfo, SignedUploadParams } from '../dto/cloudinary';
import { env } from '../config/env';

export const CLOUDINARY_STORAGE_ROOT = 'file-storage';

// Cloudinary rejects single (non-chunked) upload requests larger than 100 MB.
// Chunked uploads would require the client to send (and the backend to sign)
// a `chunk_size` parameter, which the current client-side contract does not use.
export const CLOUDINARY_SINGLE_UPLOAD_LIMIT_BYTES = 100 * 1024 * 1024;

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

    if (input.sizeBytes > CLOUDINARY_SINGLE_UPLOAD_LIMIT_BYTES) {
      throw AppError.payloadTooLarge(
        `File exceeds Cloudinary's ${Math.round(CLOUDINARY_SINGLE_UPLOAD_LIMIT_BYTES / (1024 * 1024))} MB single-upload limit.` +
          ' Chunked uploads are not supported yet; please upload a smaller file.',
        'CLOUDINARY_SINGLE_UPLOAD_LIMIT_EXCEEDED',
      );
    }

    const publicId = CloudinaryService.buildPublicId(input.userId, input.storageId);
    const timestamp = Math.floor(Date.now() / 1000);

    // Cloudinary recomputes the signature from the parameters it actually
    // receives in the upload POST (excluding `file`, `cloud_name`,
    // `resource_type` and `api_key`). The client only sends `public_id` and
    // `timestamp`, so the signature MUST cover exactly those two parameters.
    // Signing anything else (e.g. `chunk_size`) that the client never sends
    // makes every comparison fail with "Invalid Signature":
    // e.g. 'public_id=...&timestamp=...' vs 'chunk_size=...&public_id=...&timestamp=...'
    const paramsToSign: Record<string, string | number | boolean> = {
      timestamp,
      public_id: publicId,
    };

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
    } catch (error) {
      throw CloudinaryService.toAssetError(error);
    }
  }

  static async deleteAsset(publicId: string, resourceType: CloudinaryResourceType): Promise<void> {
    assertConfigured();

    let result: { result?: string };
    try {
      result = await cloudinaryClient.uploader.destroy(publicId, {
        resource_type: CloudinaryService.toDestroyType(resourceType),
        invalidate: true,
      });
    } catch (error) {
      throw CloudinaryService.toAssetError(error, 'Failed to delete the file from Cloudinary', 'CLOUDINARY_DELETE_FAILED');
    }

    if (result.result !== 'ok' && result.result !== 'not found') {
      throw AppError.badRequest('Failed to delete the file from Cloudinary', 'CLOUDINARY_DELETE_FAILED', {
        value: result.result,
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

  private static toAssetError(
    error: unknown,
    fallbackMessage = 'Failed to verify the asset on Cloudinary',
    defaultCode = 'CLOUDINARY_VERIFY_FAILED',
  ): AppError {
    const httpCode = CloudinaryService.extractHttpCode(error);

    // Cloudinary returns HTTP 400/404 when the asset does not exist yet (e.g. a
    // video that is still processing, or a wrong public ID). This is a client
    // error, not a server failure.
    if (httpCode === 404 || httpCode === 400) {
      return AppError.badRequest(
        'The asset could not be found on Cloudinary. Check that the public ID and resource type are correct, and that the upload finished processing.',
        'CLOUDINARY_ASSET_NOT_FOUND',
        CloudinaryService.extractDetails(error),
      );
    }

    return AppError.internal(fallbackMessage, defaultCode, CloudinaryService.extractDetails(error));
  }

  private static extractHttpCode(error: unknown): number | undefined {
    if (!error || typeof error !== 'object') {
      return undefined;
    }
    const candidate = String(
      (error as { http_code?: unknown }).http_code ??
        (error as { error?: { http_code?: unknown } }).error?.http_code ??
        '',
    );
    if (candidate === '') {
      return undefined;
    }
    const parsed = Number(candidate);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private static extractDetails(error: unknown): Record<string, unknown> | undefined {
    if (!error || typeof error !== 'object') {
      return undefined;
    }
    const candidate = error as {
      message?: unknown;
      error?: unknown;
      http_code?: unknown;
    };
    const message =
      typeof candidate.message === 'string'
        ? candidate.message
        : typeof candidate.error === 'string'
          ? candidate.error
          : candidate.error && typeof candidate.error === 'object' && 'message' in candidate.error
            ? String((candidate.error as { message: unknown }).message)
            : undefined;

    const details: Record<string, unknown> = {};
    if (message) {
      details.message = message;
    }
    if (candidate.http_code !== undefined) {
      details.httpCode = candidate.http_code;
    }
    return Object.keys(details).length > 0 ? details : undefined;
  }
}
