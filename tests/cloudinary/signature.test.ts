import { createHash } from 'crypto';
import { CloudinaryService } from '../../src/services/CloudinaryService';
import { isCloudinaryConfigured } from '../../src/config/cloudinary';
import { env } from '../../src/config/env';
import { CloudinaryResourceType } from '../../src/enums';

const describeConfigured = isCloudinaryConfigured ? describe : describe.skip;

describeConfigured('CloudinaryService signature', () => {
  it('generates a valid Cloudinary API signature without leaking the secret', () => {
    const params = CloudinaryService.generateSignedUploadParams({
      userId: 'user-123',
      storageId: 'storage-456',
      resourceType: CloudinaryResourceType.RAW,
      sizeBytes: 5000,
    });

    const base = `public_id=${params.publicId}&timestamp=${params.timestamp}`;
    const expected = createHash('sha1').update(`${base}${env.CLOUDINARY_API_SECRET}`).digest('hex');

    expect(params.signature).toBe(expected);
    expect(params.apiKey).toBe(env.CLOUDINARY_API_KEY);
    expect(params.cloudName).toBe(env.CLOUDINARY_CLOUD_NAME);
    expect(params.publicId).toBe('file-storage/user-123/storage-456');

    const serialized = JSON.stringify(params);
    expect(serialized).not.toContain(env.CLOUDINARY_API_SECRET!);
  });

  it('includes chunk_size for large files (chunked-upload architecture)', () => {
    const params = CloudinaryService.generateSignedUploadParams({
      userId: 'user-large',
      storageId: 'storage-large',
      resourceType: CloudinaryResourceType.VIDEO,
      sizeBytes: 150 * 1024 * 1024,
    });

    const base = `chunk_size=20971520&public_id=${params.publicId}&timestamp=${params.timestamp}`;
    const expected = createHash('sha1').update(`${base}${env.CLOUDINARY_API_SECRET}`).digest('hex');

    expect(params.signature).toBe(expected);
  });
});