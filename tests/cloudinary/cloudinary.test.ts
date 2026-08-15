jest.mock('../../src/config/cloudinary', () => ({
  isCloudinaryConfigured: false,
  cloudinaryClient: {},
}));

import { CloudinaryResourceType } from '../../src/enums';
import { CloudinaryService } from '../../src/services/CloudinaryService';

describe('CloudinaryService', () => {
  describe('storage identifiers', () => {
    it('generates a unique storage id', () => {
      expect(CloudinaryService.generateStorageId()).toBeTruthy();
      expect(CloudinaryService.generateStorageId()).not.toBe(CloudinaryService.generateStorageId());
    });

    it('builds a deterministic server-generated storage path without the original filename', () => {
      expect(CloudinaryService.buildPublicId('user-1', 'storage-id-1')).toBe(
        'file-storage/user-1/storage-id-1',
      );
      expect(CloudinaryService.buildFolder('user-1')).toBe('file-storage/user-1');
    });
  });

  describe('when Cloudinary is not configured', () => {
    it('throws CLOUDINARY_NOT_CONFIGURED when generating a signed upload', () => {
      expect(() =>
        CloudinaryService.generateSignedUploadParams({
          userId: 'user-1',
          storageId: 'storage-id-1',
          resourceType: CloudinaryResourceType.RAW,
          sizeBytes: 1024,
        }),
      ).toThrow(/Cloudinary is not configured/);
    });
  });
});