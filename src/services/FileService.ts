import { randomBytes } from 'crypto';
import { CloudinaryResourceType, FileStatus, FileVisibility } from '../enums';
import { fileRepository, FileListResult, userRepository } from '../repositories';
import { FileEntity } from '../entities';
import { AppError } from '../utils';
import { CloudinaryService } from './CloudinaryService';
import { sanitizeFilename, validateAndNormalizeUploadMeta, validateFileSize, selectCloudinaryResourceType } from '../utils';
import { FileView, PaginatedFiles, PublicShareResult, ShareResult, StorageUsageView } from '../dto/file';
import { env } from '../config/env';

export class FileService {
  static async requestUploadSignature(data: {
    userId: string;
    filename: string;
    mimeType?: string;
    size: number;
  }): Promise<{ storageId: string } & ReturnType<typeof CloudinaryService.generateSignedUploadParams>> {
    const meta = validateAndNormalizeUploadMeta({
      filename: data.filename,
      mimeType: data.mimeType,
      size: data.size,
    });

    await FileService.assertQuotaAvailable(data.userId, meta.size);

    const storageId = CloudinaryService.generateStorageId();
    const resourceType = selectCloudinaryResourceType(meta.extension);

    const signed = CloudinaryService.generateSignedUploadParams({
      userId: data.userId,
      storageId,
      resourceType,
      sizeBytes: data.size,
    });

    return { ...signed, storageId };
  }

  static async completeUpload(data: {
    userId: string;
    publicId: string;
    originalName: string;
    resourceType?: CloudinaryResourceType;
    mimeType?: string;
    size?: number;
  }): Promise<FileView> {
    const resourceType = FileService.resolveResourceType(data.resourceType);
    const asset = await CloudinaryService.getAssetInfo(data.publicId, resourceType);

    const meta = validateAndNormalizeUploadMeta({
      filename: data.originalName,
      mimeType: data.mimeType,
      size: data.size,
    });

    if (data.size !== undefined) {
      validateFileSize(data.size);
      const diffRatio = Math.abs(data.size - asset.size) / asset.size;
      if (diffRatio > 0.05) {
        throw AppError.badRequest(
          `Declared file size (${data.size} bytes) does not match the uploaded asset (${asset.size} bytes)`,
          'SIZE_MISMATCH',
        );
      }
    }

    await FileService.assertQuotaAvailable(data.userId, asset.size);

    const authoritativeResourceType = FileService.resolveResourceType(asset.resourceType as CloudinaryResourceType);

    const file = await fileRepository.create({
      ownerId: data.userId,
      originalName: meta.originalName,
      storageKey: data.publicId,
      cloudinaryPublicId: data.publicId,
      resourceType: authoritativeResourceType,
      mimeType: meta.mimeType || 'application/octet-stream',
      extension: meta.extension,
      size: asset.size,
      visibility: FileVisibility.PRIVATE,
      status: FileStatus.COMPLETED,
    });

    return FileService.toView(file);
  }

  static async listFiles(userId: string, page: number, limit: number): Promise<PaginatedFiles> {
    const { files, total } = await this.listOwnedPages(userId, page, limit);
    return {
      files: files.map(FileService.toView),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getStorageUsage(userId: string): Promise<StorageUsageView> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw AppError.unauthorized('User no longer exists', 'USER_NOT_FOUND');
    }
    const usedBytes = await fileRepository.sumOwnedSize(userId);
    return FileService.buildStorageUsage(usedBytes, user.storageQuotaBytes);
  }

  static async getOwnedFile(userId: string, fileId: string): Promise<FileView> {
    const file = await FileService.requireOwnerFile(userId, fileId);
    return FileService.toView(file);
  }

  static async renameFile(userId: string, fileId: string, newName: string): Promise<FileView> {
    const file = await FileService.requireOwnerFile(userId, fileId);
    const originalName = sanitizeFilename(newName);
    file.originalName = originalName;
    const saved = await fileRepository.save(file);
    return FileService.toView(saved);
  }

  static async deleteFile(userId: string, fileId: string): Promise<void> {
    const file = await FileService.requireOwnerFile(userId, fileId);
    await CloudinaryService.deleteAsset(file.cloudinaryPublicId, file.resourceType);
    await fileRepository.remove(file);
  }

  static async getDownloadUrl(userId: string, fileId: string): Promise<{ url: string }> {
    const file = await FileService.requireOwnerFile(userId, fileId);
    if (!file.cloudinaryPublicId) {
      throw AppError.internal('This file has no stored asset', 'FILE_ASSET_MISSING');
    }
    return { url: CloudinaryService.getSecureUrl(file.cloudinaryPublicId, file.resourceType, file.extension) };
  }

  static async getDownloadFile(userId: string, fileId: string): Promise<{ file: FileEntity; url: string }> {
    const file = await FileService.requireOwnerFile(userId, fileId);
    if (!file.cloudinaryPublicId) {
      throw AppError.internal('This file has no stored asset', 'FILE_ASSET_MISSING');
    }
    return { file, url: CloudinaryService.getSecureUrl(file.cloudinaryPublicId, file.resourceType, file.extension) };
  }

  static async setVisibility(userId: string, fileId: string, visibility: FileVisibility): Promise<FileView> {
    const file = await FileService.requireOwnerFile(userId, fileId);
    file.visibility = visibility;
    if (visibility === FileVisibility.PRIVATE) {
      file.shareToken = null;
    }
    const saved = await fileRepository.save(file);
    return FileService.toView(saved);
  }

  static async createShare(userId: string, fileId: string): Promise<ShareResult> {
    const file = await FileService.requireOwnerFile(userId, fileId);
    const shareToken = randomBytes(32).toString('hex');
    file.shareToken = shareToken;
    file.visibility = FileVisibility.PUBLIC;
    const saved = await fileRepository.save(file);
    return {
      file: FileService.toView(saved),
      shareToken,
      shareUrl: FileService.buildShareUrl(shareToken),
    };
  }

  static async disableShare(userId: string, fileId: string): Promise<FileView> {
    const file = await FileService.requireOwnerFile(userId, fileId);
    file.shareToken = null;
    file.visibility = FileVisibility.PRIVATE;
    const saved = await fileRepository.save(file);
    return FileService.toView(saved);
  }

  static async getPublicFile(shareToken: string): Promise<PublicShareResult> {
    const file = await fileRepository.findByShareToken(shareToken);
    if (!file || file.visibility !== FileVisibility.PUBLIC) {
      throw AppError.notFound('Shared file not found or no longer available', 'SHARE_NOT_FOUND');
    }
    if (!file.cloudinaryPublicId) {
      throw AppError.internal('This file has no stored asset', 'FILE_ASSET_MISSING');
    }
    return {
      file: FileService.toView(file),
      downloadUrl: CloudinaryService.getSecureUrl(file.cloudinaryPublicId, file.resourceType, file.extension),
    };
  }

  static async getPublicDownloadFile(shareToken: string): Promise<{ file: FileEntity; url: string }> {
    const file = await fileRepository.findByShareToken(shareToken);
    if (!file || file.visibility !== FileVisibility.PUBLIC) {
      throw AppError.notFound('Shared file not found or no longer available', 'SHARE_NOT_FOUND');
    }
    if (!file.cloudinaryPublicId) {
      throw AppError.internal('This file has no stored asset', 'FILE_ASSET_MISSING');
    }
    return { file, url: CloudinaryService.getSecureUrl(file.cloudinaryPublicId, file.resourceType, file.extension) };
  }

  private static buildShareUrl(shareToken: string): string {
    return `${env.APP_BASE_URL}/api/share/${shareToken}`;
  }

  private static async listOwnedPages(userId: string, page: number, limit: number): Promise<FileListResult> {
    return fileRepository.findByOwnerId(userId, page, limit);
  }

  private static async requireOwnerFile(userId: string, fileId: string): Promise<FileEntity> {
    const file = await fileRepository.findByIdAndOwner(fileId, userId);
    if (!file) {
      throw AppError.notFound('File not found', 'FILE_NOT_FOUND');
    }
    return file;
  }

  private static async assertQuotaAvailable(userId: string, additionalBytes: number): Promise<void> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw AppError.unauthorized('User no longer exists', 'USER_NOT_FOUND');
    }
    const usedBytes = await fileRepository.sumOwnedSize(userId);
    const remainingBytes = Math.max(0, user.storageQuotaBytes - usedBytes);
    if (additionalBytes > remainingBytes) {
      throw AppError.payloadTooLarge(
        `Storage quota exceeded. ${usedBytes} of ${user.storageQuotaBytes} bytes used; only ${remainingBytes} bytes remaining.`,
        'STORAGE_QUOTA_EXCEEDED',
        {
          usedBytes,
          quotaBytes: user.storageQuotaBytes,
          remainingBytes,
          requestedBytes: additionalBytes,
        },
      );
    }
  }

  static buildStorageUsage(usedBytes: number, quotaBytes: number): StorageUsageView {
    return {
      usedBytes,
      quotaBytes,
      remainingBytes: Math.max(0, quotaBytes - usedBytes),
      percentUsed: quotaBytes > 0 ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100)) : 0,
    };
  }

  private static resolveResourceType(value?: CloudinaryResourceType): CloudinaryResourceType {
    if (value && Object.values(CloudinaryResourceType).includes(value)) {
      return value;
    }
    return CloudinaryResourceType.RAW;
  }

  static toView(file: FileEntity): FileView {
    return {
      id: file.id,
      originalName: file.originalName,
      mimeType: file.mimeType,
      extension: file.extension,
      size: file.size,
      visibility: file.visibility,
      status: file.status,
      resourceType: file.resourceType,
      shareToken: file.shareToken,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    };
  }
}
