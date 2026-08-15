import request from 'supertest';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../../src/config/database';
import { createApp } from '../../src/app';
import { initTestDatabase } from '../helpers/db';
import { env } from '../../src/config/env';

const app = createApp();

let counter = 0;
const uniqueEmail = (): string => `user${++counter}-${Date.now()}@example.com`;

const VALID_USER = {
  name: 'John Doe',
  email: 'john@example.com',
  password: 'StrongPassword123!',
};

describe('Authentication', () => {
  beforeAll(async () => {
    await initTestDatabase();
  }, 60000);

  afterAll(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  describe('POST /api/auth/register', () => {
    it('registers a user and returns safe user info + access token', async () => {
      const res = await request(app).post('/api/auth/register').send(VALID_USER);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toMatchObject({
        name: 'John Doe',
        email: 'john@example.com',
      });
      expect(res.body.data.user.id).toBeDefined();
      expect(res.body.data.user.createdAt).toBeDefined();
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
      expect(typeof res.body.data.accessToken).toBe('string');
    });

    it('rejects a duplicate email with 409', async () => {
      const email = uniqueEmail();
      await request(app).post('/api/auth/register').send({ ...VALID_USER, email });

      const res = await request(app).post('/api/auth/register').send({ ...VALID_USER, email, name: 'Jane Doe' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');
    });

    it('rejects an invalid email with 422', async () => {
      const res = await request(app).post('/api/auth/register').send({ ...VALID_USER, email: 'not-an-email' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects a weak password with 422', async () => {
      const res = await request(app).post('/api/auth/register').send({ ...VALID_USER, password: 'weak' });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects missing fields with 422', async () => {
      const res = await request(app).post('/api/auth/register').send({});

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/login', () => {
    it('logs in with valid credentials', async () => {
      const email = uniqueEmail();
      await request(app).post('/api/auth/register').send({ ...VALID_USER, email });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email, password: VALID_USER.password });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(email);
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
      expect(typeof res.body.data.accessToken).toBe('string');
    });

    it('rejects an incorrect password with 401', async () => {
      const email = uniqueEmail();
      await request(app).post('/api/auth/register').send({ ...VALID_USER, email });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'WrongPassword123!' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('rejects an unknown email with 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: uniqueEmail(), password: 'Whatever123!' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('rejects missing fields with 422', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: 'someone@example.com' });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/auth/me', () => {
    let registeredUserId: string;
    let validToken: string;

    beforeAll(async () => {
      const email = uniqueEmail();
      const res = await request(app).post('/api/auth/register').send({ ...VALID_USER, email });
      registeredUserId = res.body.data.user.id;
      validToken = res.body.data.accessToken;
    });

    it('returns the current user with a valid token', async () => {
      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(registeredUserId);
      expect(res.body.data.email).toBeDefined();
      expect(res.body.data).not.toHaveProperty('passwordHash');
    });

    it('rejects a missing token with 401', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('TOKEN_MISSING');
    });

    it('rejects an invalid token with 401', async () => {
      const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not.a.valid.token');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('rejects an expired token with 401', async () => {
      const expiredToken = jwt.sign({ sub: registeredUserId }, env.JWT_SECRET, { expiresIn: '1ms' });
      await new Promise((resolve) => setTimeout(resolve, 20));

      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
    });

    it('rejects a token whose user no longer exists with 401', async () => {
      const ghostToken = jwt.sign({ sub: '00000000-0000-4000-8000-000000000000' }, env.JWT_SECRET);
      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${ghostToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('USER_NOT_FOUND');
    });
  });
});