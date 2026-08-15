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
const uniqueEmail = (): string => `share${++counter}-${Date.now()}@example.com`;

const USER_A = { name: 'Alice', email: uniqueEmail(), password: 'StrongPassword123!' };
const USER_B = { name: 'Bob', email: uniqueEmail(), password: 'StrongPassword123!' };

const authHeader = (token: string): { Authorization: string } => ({ Authorization: `Bearer ${token}` });

async function registerAndGetToken(user: { name: string; email: string; password: string }): Promise<string> {
  const res = await request(app).post('/api/auth/register').send(user);
  expect(res.status).toBe(201);
  return res.body.data.accessToken;
}

async function createFileForUser(token: string, publicId: string): Promise<{ id: string; shareToken: string | null }> {
  const res = await request(app)
    .post('/api/files/complete')
    .set(authHeader(token))
    .send({
      publicId,
      originalName: 'shared.pdf',
      resourceType: 'raw',
      mimeType: 'application/pdf',
      size: 1234,
    });
  expect(res.status).toBe(201);
  return res.body.data;
}

describe('Sharing', () => {
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

  describe('POST /api/files/:id/share', () => {
    let fileId: string;

    beforeAll(async () => {
      const file = await createFileForUser(tokenA, 'file-storage/owner/share-create-1');
      fileId = file.id;
    });

    it('generates a share token and marks the file public', async () => {
      const res = await request(app).post(`/api/files/${fileId}/share`).set(authHeader(tokenA));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.shareToken).toBeTruthy();
      expect(res.body.data.shareUrl).toContain(res.body.data.shareToken);
      expect(res.body.data.file.visibility).toBe('public');
      expect(res.body.data.file.shareToken).toBe(res.body.data.shareToken);
    });

    it('generates a new token each time (old token is invalidated)', async () => {
      const first = await request(app).post(`/api/files/${fileId}/share`).set(authHeader(tokenA));
      const second = await request(app).post(`/api/files/${fileId}/share`).set(authHeader(tokenA));

      expect(first.body.data.shareToken).not.toBe(second.body.data.shareToken);

      const old = await request(app).get(`/api/share/${first.body.data.shareToken}`);
      expect(old.status).toBe(404);
    });

    it('cannot create a share link for another user file (404)', async () => {
      const res = await request(app).post(`/api/files/${fileId}/share`).set(authHeader(tokenB));

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('FILE_NOT_FOUND');
    });
  });

  describe('GET /api/share/:shareToken', () => {
    let shareToken: string;

    beforeAll(async () => {
      const file = await createFileForUser(tokenA, 'file-storage/owner/share-access-1');
      const res = await request(app).post(`/api/files/${file.id}/share`).set(authHeader(tokenA));
      shareToken = res.body.data.shareToken;
    });

    it('returns a public shared file without authentication', async () => {
      const res = await request(app).get(`/api/share/${shareToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.file.id).toBeDefined();
      expect(res.body.data.file.visibility).toBe('public');
      expect(res.body.data.downloadUrl).toContain('file-storage/owner/share-access-1');
    });

    it('returns 404 for an invalid share token', async () => {
      const res = await request(app).get('/api/share/not-a-real-token');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('SHARE_NOT_FOUND');
    });
  });

  describe('PATCH /api/files/:id/visibility', () => {
    let fileId: string;

    beforeAll(async () => {
      const file = await createFileForUser(tokenA, 'file-storage/owner/vis-1');
      fileId = file.id;
    });

    it('lets the owner make the file public', async () => {
      const res = await request(app)
        .patch(`/api/files/${fileId}/visibility`)
        .set(authHeader(tokenA))
        .send({ visibility: 'public' });

      expect(res.status).toBe(200);
      expect(res.body.data.visibility).toBe('public');
    });

    it('lets the owner make the file private again', async () => {
      const res = await request(app)
        .patch(`/api/files/${fileId}/visibility`)
        .set(authHeader(tokenA))
        .send({ visibility: 'private' });

      expect(res.status).toBe(200);
      expect(res.body.data.visibility).toBe('private');
    });

    it('rejects an invalid visibility value with 422', async () => {
      const res = await request(app)
        .patch(`/api/files/${fileId}/visibility`)
        .set(authHeader(tokenA))
        .send({ visibility: 'everyone' });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('cannot change visibility of another user file (404)', async () => {
      const res = await request(app)
        .patch(`/api/files/${fileId}/visibility`)
        .set(authHeader(tokenB))
        .send({ visibility: 'public' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('FILE_NOT_FOUND');
    });
  });

  describe('DELETE /api/files/:id/share', () => {
    let fileId: string;
    let shareToken: string;

    beforeAll(async () => {
      const file = await createFileForUser(tokenA, 'file-storage/owner/share-disable-1');
      fileId = file.id;
      const res = await request(app).post(`/api/files/${fileId}/share`).set(authHeader(tokenA));
      shareToken = res.body.data.shareToken;
    });

    it('disables sharing and makes the file private', async () => {
      const res = await request(app).delete(`/api/files/${fileId}/share`).set(authHeader(tokenA));

      expect(res.status).toBe(200);
      expect(res.body.data.visibility).toBe('private');
      expect(res.body.data.shareToken).toBeNull();
    });

    it('old share token no longer provides access (404)', async () => {
      const res = await request(app).get(`/api/share/${shareToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('SHARE_NOT_FOUND');
    });

    it('cannot disable sharing of another user file (404)', async () => {
      const res = await request(app).delete(`/api/files/${fileId}/share`).set(authHeader(tokenB));

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('FILE_NOT_FOUND');
    });
  });
});