import request from 'supertest';
import { createApp } from '../../src/app';

const app = createApp();

describe('Security hardening', () => {
  describe('rate limiting', () => {
    it('blocks repeated failed login attempts with 429', async () => {
      let saw429 = false;
      for (let i = 0; i < 25; i += 1) {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ email: 'rate-limit@example.com' });
        if (res.status === 429) {
          saw429 = true;
        }
      }

      expect(saw429).toBe(true);

      const blocked = await request(app)
        .post('/api/auth/login')
        .send({ email: 'rate-limit@example.com' });
      expect(blocked.status).toBe(429);
      expect(blocked.body.success).toBe(false);
      expect(blocked.body.error.code).toBe('TOO_MANY_REQUESTS');
    });
  });

  describe('security headers', () => {
    it('serves hardening headers and hides the server framework', async () => {
      const res = await request(app).get('/api/definitely-not-a-route');

      expect(res.status).toBe(404);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['x-download-options']).toBe('noopen');
      expect(res.headers['referrer-policy']).toBeDefined();
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });
});