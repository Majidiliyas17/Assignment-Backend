import { randomBytes } from 'crypto';
import { CloudinaryService } from '../../src/services/CloudinaryService';
import { isCloudinaryConfigured } from '../../src/config/cloudinary';
import { CloudinaryResourceType } from '../../src/enums';
import { directUpload } from '../helpers/cloudinary-upload';

const enabled = isCloudinaryConfigured && process.env.CLOUDINARY_INTEGRATION === 'true';

const describeIntegration = enabled ? describe : describe.skip;

describeIntegration('Cloudinary integration', () => {
  it('uploads via backend-signed params, verifies the asset, then cleans up', async () => {
    const content = randomBytes(2048);
    const params = CloudinaryService.generateSignedUploadParams({
      userId: 'integration-test',
      storageId: CloudinaryService.generateStorageId(),
      resourceType: CloudinaryResourceType.RAW,
      sizeBytes: content.length,
    });

    const uploaded = await directUpload(params, content);
    const finalPublicId = uploaded.public_id;
    expect(finalPublicId).toBe(`${params.publicId}.txt`);
    expect(uploaded.bytes).toBe(content.length);

    const info = await CloudinaryService.getAssetInfo(finalPublicId, CloudinaryResourceType.RAW);
    expect(info.publicId).toBe(finalPublicId);
    expect(info.size).toBe(content.length);

    const secureUrl = CloudinaryService.getSecureUrl(finalPublicId, CloudinaryResourceType.RAW);
    expect(secureUrl).toContain(params.cloudName);

    await CloudinaryService.deleteAsset(finalPublicId, CloudinaryResourceType.RAW);
    await expect(
      CloudinaryService.getAssetInfo(finalPublicId, CloudinaryResourceType.RAW),
    ).rejects.toMatchObject({ code: 'CLOUDINARY_VERIFY_FAILED' });
  }, 30000);
});