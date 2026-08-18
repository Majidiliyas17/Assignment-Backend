import { createHash } from 'crypto';
import { CloudinaryService, CLOUDINARY_SINGLE_UPLOAD_LIMIT_BYTES } from '../../src/services/CloudinaryService';
import { isCloudinaryConfigured } from '../../src/config/cloudinary';
import { env } from '../../src/config/env';
import { CloudinaryResourceType } from '../../src/enums';

const describeConfigured = isCloudinaryConfigured ? describe : describe.skip;

function signSize(sizeBytes: number) {
  return CloudinaryService.generateSignedUploadParams({
    userId: 'user-123',
    storageId: 'storage-456',
    resourceType: CloudinaryResourceType.RAW,
    sizeBytes,
  });
}

describeConfigured('CloudinaryService signature', () => {
  it('signs exactly the parameters the client sends (public_id + timestamp)', () => {
    const params = signSize(5000);

    const base = `public_id=${params.publicId}&timestamp=${params.timestamp}`;
    const expected = createHash('sha1').update(`${base}${env.CLOUDINARY_API_SECRET}`).digest('hex');

    expect(params.signature).toBe(expected);
    expect(params.apiKey).toBe(env.CLOUDINARY_API_KEY);
    expect(params.cloudName).toBe(env.CLOUDINARY_CLOUD_NAME);
    expect(params.publicId).toBe('file-storage/user-123/storage-456');

    const serialized = JSON.stringify(params);
    expect(serialized).not.toContain(env.CLOUDINARY_API_SECRET!);
  });

  it.each([5000, 10 * 1024 * 1024, 90 * 1024 * 1024])(
    'produces the same signature contract regardless of file size (%i bytes)',
    (sizeBytes) => {
      const params = signSize(sizeBytes);

      const base = `public_id=${params.publicId}&timestamp=${params.timestamp}`;
      const expected = createHash('sha1').update(`${base}${env.CLOUDINARY_API_SECRET}`).digest('hex');

      expect(params.signature).toBe(expected);
    },
  );

  it('rejects files above Cloudinary single-upload limit with a clear error', () => {
    expect(() => signSize(CLOUDINARY_SINGLE_UPLOAD_LIMIT_BYTES + 1)).toThrow(/100 MB single-upload limit/);
  });
});