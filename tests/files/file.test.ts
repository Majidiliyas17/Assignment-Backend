jest.mock('../../src/services/CloudinaryService', () => ({
  CloudinaryService: {
    generateStorageId: jest.fn(() => 'test-storage-id'),
    buildPublicId: jest.fn((userId: string, storageId: string) => `file-storage/${userId}/${storageId}`),
    buildFolder: jest.fn((userId: string) => `file-storage/${userId}`),
    generateSignedUploadParams: jest.fn(() => ({
      signature: 'test-signature',
      timestamp: '1234567890',
      apiKey: 'test-api-key',
      cloudName: 'test-cloud',
      folder: 'file-storage/test',
      publicId: 'file-storage/test/storage-1',
      resourceType: 'raw',
    })),
    getAssetInfo: jest.fn(async (publicId: string, resourceType: string) => ({
      publicId,
      size: 1234,
      resourceType,
      format: 'pdf',
    })),
    deleteAsset: jest.fn(async () => undefined),
    getSecureUrl: jest.fn((publicId: string) => `https://res.cloudinary.com/test/${publicId}`),
  },
}));

import request from 'supertest';
import { AppDataSource } from '../../src/config/database';
import { createApp } from '../../src/app';
import { initTestDatabase } from '../helpers/db';

const app = createApp();

let counter = 0;
const uniqueEmail = (): string => `file${++counter}-${Date.now()}@example.com`;

const USER_A = {
  name: 'Alice',
  email: uniqueEmail(),
  password: 'StrongPassword123!',
};
const USER_B = {
  name: 'Bob',
  email: uniqueEmail(),
  password: 'StrongPassword123!',
};

const authHeader = (token: string): { Authorization: string } => ({ Authorization: `Bearer ${token}` });

async function registerAndGetToken(user: { name: string; email: string; password: string }): Promise<string> {
  const res = await request(app).post('/api/auth/register').send(user);
  expect(res.status).toBe(201);
  return res.body.data.accessToken;
}

async function completeUpload(
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<request.Response> {
  return request(app)
    .post('/api/files/complete')
    .set(authHeader(token))
    .send({
      publicId: 'file-storage/owner/asset-123',
      originalName: 'document.pdf',
      resourceType: 'raw',
      mimeType: 'application/pdf',
      size: 1234,
      ...overrides,
    });
}

describe('File Management', () => {
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    await initTestDatabase();
    [tokenA, tokenB] = await Promise.all([registerAndGetToken(USER_A), registerAndGetToken(USER_B)]);
  }, 60000);

  afterAll(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  describe('POST /api/files/upload-signature', () => {
    it('returns a signed upload payload for an authenticated user', async () => {
      const res = await request(app)
        .post('/api/files/upload-signature')
        .set(authHeader(tokenA))
        .send({ filename: 'photo.jpg', mimeType: 'image/jpeg', size: 1500 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('signature');
      expect(res.body.data).toHaveProperty('timestamp');
      expect(res.body.data).toHaveProperty('apiKey');
      expect(res.body.data).toHaveProperty('cloudName');
      expect(res.body.data).toHaveProperty('folder');
      expect(res.body.data).toHaveProperty('publicId');
      expect(res.body.data.publicId).not.toBe('photo.jpg');
      expect(JSON.stringify(res.body.data)).not.toContain('apiSecret');
      expect(JSON.stringify(res.body.data)).not.toContain('CLOUDINARY_API_SECRET');
    });

    it('rejects an unauthenticated request with 401', async () => {
      const res = await request(app)
        .post('/api/files/upload-signature')
        .send({ filename: 'photo.jpg', mimeType: 'image/jpeg', size: 1500 });

      expect(res.status).toBe(401);
    });

    it('rejects a disallowed extension with 400', async () => {
      const res = await request(app)
        .post('/api/files/upload-signature')
        .set(authHeader(tokenA))
        .send({ filename: 'virus.exe', mimeType: 'application/x-msdownload', size: 1500 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
    });

    it('rejects a MIME type that does not match the extension with 400', async () => {
      const res = await request(app)
        .post('/api/files/upload-signature')
        .set(authHeader(tokenA))
        .send({ filename: 'document.pdf', mimeType: 'image/png', size: 1500 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_MIME_TYPE');
    });

    it('rejects an oversized file with 413', async () => {
      const res = await request(app)
        .post('/api/files/upload-signature')
        .set(authHeader(tokenA))
        .send({ filename: 'huge.mp4', mimeType: 'video/mp4', size: 600 * 1024 * 1024 });

      expect(res.status).toBe(413);
      expect(res.body.error.code).toBe('FILE_TOO_LARGE');
    });
  });

  describe('POST /api/files/complete', () => {
    it('creates a private, completed file owned by the authenticated user', async () => {
      const res = await completeUpload(tokenA);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.visibility).toBe('private');
      expect(res.body.data.status).toBe('completed');
      expect(res.body.data.originalName).toBe('document.pdf');
      expect(res.body.data.size).toBe(1234);
    });

    it('rejects a file whose declared size does not match the asset with 400', async () => {
      const res = await completeUpload(tokenA, { size: 9999999 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SIZE_MISMATCH');
    });
  });

  describe('GET /api/files', () => {
    it('returns only the authenticated user files with pagination metadata', async () => {
      const before = await request(app).get('/api/files').set(authHeader(tokenA)).query({ limit: 100 });
      const beforeCount = before.body.data.pagination.total;

      await completeUpload(tokenA, { publicId: 'file-storage/owner/list-a-1' });
      await completeUpload(tokenA, { publicId: 'file-storage/owner/list-a-2' });
      const bobFile = await completeUpload(tokenB, { publicId: 'file-storage/owner/list-b-1' });
      const bobFileId = bobFile.body.data.id;

      const res = await request(app).get('/api/files').set(authHeader(tokenA)).query({ limit: 100 });

      expect(res.status).toBe(200);
      expect(res.body.data.files.length).toBe(beforeCount + 2);
      expect(res.body.data.pagination.total).toBe(beforeCount + 2);
      expect(res.body.data.files.some((f: { id: string }) => f.id === bobFileId)).toBe(false);
      expect(res.body.data.pagination.page).toBe(1);
    });

    it('supports pagination', async () => {
      const before = await request(app).get('/api/files').set(authHeader(tokenA)).query({ limit: 100 });
      const total = before.body.data.pagination.total;
      const expectedTotalPages = Math.ceil(total / 2);

      const res = await request(app).get('/api/files').set(authHeader(tokenA)).query({ page: 1, limit: 2 });

      expect(res.status).toBe(200);
      expect(res.body.data.files.length).toBe(Math.min(2, total));
      expect(res.body.data.pagination.total).toBe(total);
      expect(res.body.data.pagination.totalPages).toBe(expectedTotalPages);
      expect(res.body.data.pagination.page).toBe(1);
    });

    it('rejects an unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/files');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/files/:id', () => {
    let ownFileId: string;

    beforeAll(async () => {
      const res = await completeUpload(tokenA, { publicId: 'file-storage/owner/detail-1' });
      ownFileId = res.body.data.id;
    });

    it('returns a file the user owns', async () => {
      const res = await request(app).get(`/api/files/${ownFileId}`).set(authHeader(tokenA));

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(ownFileId);
      expect(res.body.data.originalName).toBe('document.pdf');
    });

    it('does not disclose another user private file (404)', async () => {
      const res = await request(app).get(`/api/files/${ownFileId}`).set(authHeader(tokenB));

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('FILE_NOT_FOUND');
    });
  });

  describe('PATCH /api/files/:id', () => {
    let ownFileId: string;

    beforeAll(async () => {
      const res = await completeUpload(tokenA, { publicId: 'file-storage/owner/rename-1' });
      ownFileId = res.body.data.id;
    });

    it('renames an owned file', async () => {
      const res = await request(app)
        .patch(`/api/files/${ownFileId}`)
        .set(authHeader(tokenA))
        .send({ name: 'final-report.pdf' });

      expect(res.status).toBe(200);
      expect(res.body.data.originalName).toBe('final-report.pdf');
    });

    it('cannot rename another user file (404)', async () => {
      const res = await request(app)
        .patch(`/api/files/${ownFileId}`)
        .set(authHeader(tokenB))
        .send({ name: 'hacked.pdf' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('FILE_NOT_FOUND');
    });
  });

  describe('GET /api/files/:id/preview', () => {
    let ownFileId: string;

    beforeAll(async () => {
      const res = await completeUpload(tokenA, { publicId: 'file-storage/owner/download-1' });
      ownFileId = res.body.data.id;
    });

    it('generates a delivery URL for the owner', async () => {
      const res = await request(app).get(`/api/files/${ownFileId}/preview`).set(authHeader(tokenA));

      expect(res.status).toBe(200);
      expect(res.body.data.url).toContain('file-storage/owner/download-1');
    });

    it('cannot preview another user file (404)', async () => {
      const res = await request(app).get(`/api/files/${ownFileId}/preview`).set(authHeader(tokenB));

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('FILE_NOT_FOUND');
    });
  });

  describe('GET /api/files/:id/download', () => {
    let ownFileId: string;

    beforeAll(async () => {
      const res = await completeUpload(tokenA, { publicId: 'file-storage/owner/download-1' });
      ownFileId = res.body.data.id;
    });

    it('surfaces a clear 502 DOWNLOAD_FAILED when the storage upstream is unavailable', async () => {
      const res = await request(app).get(`/api/files/${ownFileId}/download`).set(authHeader(tokenA));

      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe('DOWNLOAD_FAILED');
    });

    it('cannot download another user file (404)', async () => {
      const res = await request(app).get(`/api/files/${ownFileId}/download`).set(authHeader(tokenB));

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('FILE_NOT_FOUND');
    });
  });

  describe('DELETE /api/files/:id', () => {
    it('deletes an owned file and removes the record', async () => {
      const res = await completeUpload(tokenA, { publicId: 'file-storage/owner/delete-1' });
      const fileId = res.body.data.id;

      const del = await request(app).delete(`/api/files/${fileId}`).set(authHeader(tokenA));
      expect(del.status).toBe(200);
      expect(del.body.success).toBe(true);

      const after = await request(app).get(`/api/files/${fileId}`).set(authHeader(tokenA));
      expect(after.status).toBe(404);
    });

    it('cannot delete another user file (404)', async () => {
      const res = await completeUpload(tokenA, { publicId: 'file-storage/owner/delete-2' });
      const fileId = res.body.data.id;

      const del = await request(app).delete(`/api/files/${fileId}`).set(authHeader(tokenB));
      expect(del.status).toBe(404);
      expect(del.body.error.code).toBe('FILE_NOT_FOUND');

      const stillThere = await request(app).get(`/api/files/${fileId}`).set(authHeader(tokenA));
      expect(stillThere.status).toBe(200);
    });
  });
});