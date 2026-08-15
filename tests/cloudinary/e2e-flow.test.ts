import request from 'supertest';
import { createApp } from '../../src/app';
import { initTestDatabase } from '../helpers/db';
import { directUpload } from '../helpers/cloudinary-upload';
import { CloudinaryService } from '../../src/services/CloudinaryService';
import { isCloudinaryConfigured } from '../../src/config/cloudinary';
import { CloudinaryResourceType } from '../../src/enums';
import type { SignedUploadParams } from '../../src/dto/cloudinary';

const enabled = isCloudinaryConfigured && process.env.CLOUDINARY_INTEGRATION === 'true';
const describeIntegration = enabled ? describe : describe.skip;

describeIntegration('Full upload flow (real Cloudinary + real DB)', () => {
  beforeAll(async () => {
    await initTestDatabase();
  });

  it('signs, uploads, completes, lists, downloads and deletes a file end-to-end', async () => {
    const app = createApp();

    const email = `e2e-${Date.now()}@example.com`;
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ name: 'E2E User', email, password: 'StrongPass123!' });
    expect(reg.status).toBe(201);
    const token = reg.body.data.accessToken;

    const content = Buffer.from('hello from e2e', 'utf8');

    const sigRes = await request(app)
      .post('/api/files/upload-signature')
      .set('Authorization', `Bearer ${token}`)
      .send({ filename: 'hello.txt', mimeType: 'text/plain', size: content.length });
    expect(sigRes.status).toBe(200);
    const signed = sigRes.body.data as SignedUploadParams & { storageId: string };
    expect(signed.resourceType).toBe(CloudinaryResourceType.RAW);

    const uploaded = await directUpload(signed, content);
    const finalPublicId = uploaded.public_id;
    expect(finalPublicId).toBe(`${signed.publicId}.txt`);

    const complete = await request(app)
      .post('/api/files/complete')
      .set('Authorization', `Bearer ${token}`)
      .send({
        publicId: finalPublicId,
        originalName: 'hello.txt',
        resourceType: CloudinaryResourceType.RAW,
        mimeType: 'text/plain',
        size: content.length,
      });
    expect(complete.status).toBe(201);
    expect(complete.body.data.size).toBe(content.length);
    const fileId = complete.body.data.id;

    const list = await request(app).get('/api/files').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.data.files).toHaveLength(1);
    expect(list.body.data.files[0].id).toBe(fileId);

    const dl = await request(app)
      .get(`/api/files/${fileId}/download`)
      .set('Authorization', `Bearer ${token}`);
    expect(dl.status).toBe(200);
    expect(dl.body.data.url).toContain(signed.cloudName);
    expect(dl.body.data.url).toContain(finalPublicId);

    const del = await request(app).delete(`/api/files/${fileId}`).set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);

    const gone = await request(app).get(`/api/files/${fileId}`).set('Authorization', `Bearer ${token}`);
    expect(gone.status).toBe(404);

    await expect(
      CloudinaryService.getAssetInfo(finalPublicId, CloudinaryResourceType.RAW),
    ).rejects.toMatchObject({ code: 'CLOUDINARY_VERIFY_FAILED' });
  }, 60000);
});