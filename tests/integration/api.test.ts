import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { sql } from 'drizzle-orm';
import app from '../../src/app';
import config from '../../src/config';
import { db, pool } from '../../src/database';
import { redis } from '../../src/services/redis';
import { loadQuestions } from '../../src/services/questionsDataService';

const api = () => request(app);

async function requestCode(email: string) {
  await api().post('/api/register').send({ email }).expect(200);
  const code = await redis.hget(`v_code:${email.toLowerCase()}`, 'code');
  if (!code) throw new Error('code not stored');
  return code;
}

async function login(email = 'user@example.com') {
  const code = await requestCode(email);
  const res = await api().post('/api/verify-code').send({ email, code }).expect(200);
  return res.body as { accessToken: string; refreshToken: string; expiresIn: number; refreshExpiresIn: number };
}

async function guestToken() {
  const res = await api().get('/api/access_token').expect(200);
  return res.body.accessToken as string;
}

beforeAll(() => {
  loadQuestions(config.questionsPath);
});

beforeEach(async () => {
  await redis.flushdb();
  await db.execute(sql`truncate users cascade`);
});

afterAll(async () => {
  await redis.quit();
  await pool.end();
});

describe('infra', () => {
  it('health', async () => {
    await api().get('/api/health').expect(200, { ok: true });
  });

  it('unknown route → 404, malformed JSON → 400 without internals', async () => {
    await api().get('/api/nope').expect(404);
    const res = await api().post('/api/register').set('Content-Type', 'application/json').send('{bad').expect(400);
    expect(res.body.error).toBeTypeOf('string');
  });
});

describe('guest access', () => {
  it('can get random questions without answers but not answers', async () => {
    const token = await guestToken();
    const res = await api().get('/api/quiz/random').set('X-Temporary-Token', token).expect(200);
    expect(res.body).toHaveProperty('answer_options');
    expect(res.body).not.toHaveProperty('answer');

    await api().post('/api/quiz/answer').set('X-Temporary-Token', token).send({ id: 1 }).expect(401);
  });

  it('is limited to 10 questions per hour', async () => {
    const token = await guestToken();
    for (let i = 0; i < 10; i++) {
      await api().get('/api/quiz/random').set('X-Temporary-Token', token).expect(200);
    }
    await api().get('/api/quiz/random').set('X-Temporary-Token', token).expect(429);
  });

  it('cannot bypass the guest limit with a fake Bearer header', async () => {
    const token = await guestToken();
    await api()
      .get('/api/quiz/random')
      .set('X-Temporary-Token', token)
      .set('Authorization', 'Bearer whatever')
      .expect(400);
    await api().get('/api/quiz/random').set('Authorization', 'Bearer whatever').expect(401);
  });

  it('rejects unknown / malformed guest tokens', async () => {
    await api().get('/api/quiz/random').set('X-Temporary-Token', 'not-a-uuid').expect(401);
    await api().get('/api/quiz/random').set('X-Temporary-Token', crypto.randomUUID()).expect(401);
  });

  it('only one guest token per hour per IP', async () => {
    await guestToken();
    await api().get('/api/access_token').expect(429);
  });
});

describe('registration & verification', () => {
  it('validates email', async () => {
    const res = await api().post('/api/register').send({ email: 'nope' }).expect(400);
    expect(res.body.details).toHaveProperty('email');
  });

  it('enforces resend cooldown', async () => {
    await requestCode('a@example.com');
    await api().post('/api/register').send({ email: 'A@example.com ' }).expect(429);
  });

  it('accepts code as a number and normalizes email case', async () => {
    const code = await requestCode('Case@Example.com');
    const res = await api()
      .post('/api/verify-code')
      .send({ email: 'case@example.com', code: Number(code) });
    expect(res.status).toBe(200);
  });

  it('burns the code after 5 wrong attempts', async () => {
    const code = await requestCode('b@example.com');
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      await api().post('/api/verify-code').send({ email: 'b@example.com', code: wrong }).expect(400);
    }
    const res = await api().post('/api/verify-code').send({ email: 'b@example.com', code }).expect(400);
    expect(res.body.error).toMatch(/просрочен/);
  });

  it('code is single-use', async () => {
    const code = await requestCode('c@example.com');
    await api().post('/api/verify-code').send({ email: 'c@example.com', code }).expect(200);
    await api().post('/api/verify-code').send({ email: 'c@example.com', code }).expect(400);
  });
});

describe('user access', () => {
  it('returns a token pair with week/month lifetimes', async () => {
    const tokens = await login();
    expect(tokens.expiresIn).toBe(7 * 24 * 3600);
    expect(tokens.refreshExpiresIn).toBe(30 * 24 * 3600);
  });

  it('gets answers by id and by loosely matching question text', async () => {
    const { accessToken } = await login();
    const auth = { Authorization: `Bearer ${accessToken}` };

    const byId = await api().post('/api/quiz/answer').set(auth).send({ id: 1 }).expect(200);
    expect(byId.body.answer).toBe('Зелёная');

    const byText = await api()
      .post('/api/quiz/answer')
      .set(auth)
      .send({ question: '  тестовый вопрос какого цвета елка ' })
      .expect(200);
    expect(byText.body.id).toBe(1);

    await api().post('/api/quiz/answer').set(auth).send({ id: 999 }).expect(404);
    await api().post('/api/quiz/answer').set(auth).send({}).expect(400);
  });

  it('rejects forged or foreign JWTs', async () => {
    const { accessToken } = await login();
    const { sub, sid } = jwt.decode(accessToken) as { sub: string; sid: string };

    const unsigned = jwt.sign({ sid, type: 'access' }, '', { algorithm: 'none', subject: sub });
    const wrongSecret = jwt.sign({ sid, type: 'access' }, 'x'.repeat(40), { subject: sub });
    const noType = jwt.sign({ sid }, config.jwt.secret, {
      subject: sub,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    });

    for (const t of [unsigned, wrongSecret, noType]) {
      await api().get('/api/quiz/random').set('Authorization', `Bearer ${t}`).expect(401);
    }
  });
});

describe('refresh tokens', () => {
  it('rotates and invalidates the used refresh token', async () => {
    const first = await login();
    const res = await api().post('/api/auth/refresh').send({ refreshToken: first.refreshToken }).expect(200);
    expect(res.body.refreshToken).not.toBe(first.refreshToken);

    await api().get('/api/quiz/random').set('Authorization', `Bearer ${res.body.accessToken}`).expect(200);
  });

  it('reuse of a rotated token revokes the whole session', async () => {
    const first = await login();
    const second = (await api().post('/api/auth/refresh').send({ refreshToken: first.refreshToken }).expect(200)).body;

    await api().post('/api/auth/refresh').send({ refreshToken: first.refreshToken }).expect(401);

    await api().post('/api/auth/refresh').send({ refreshToken: second.refreshToken }).expect(401);
    await api().get('/api/quiz/random').set('Authorization', `Bearer ${second.accessToken}`).expect(401);
  });

  it('rejects unknown refresh tokens', async () => {
    await api().post('/api/auth/refresh').send({ refreshToken: 'garbage' }).expect(401);
    await api().post('/api/auth/refresh').send({}).expect(400);
  });

  it('logout ends only that session', async () => {
    const a = await login('multi@example.com');
    await redis.del('v_cooldown:multi@example.com');
    const b = await login('multi@example.com');

    await api().post('/api/auth/logout').send({ refreshToken: a.refreshToken }).expect(204);

    await api().get('/api/quiz/random').set('Authorization', `Bearer ${a.accessToken}`).expect(401);
    await api().post('/api/auth/refresh').send({ refreshToken: a.refreshToken }).expect(401);
    await api().get('/api/quiz/random').set('Authorization', `Bearer ${b.accessToken}`).expect(200);
  });

  it('logout-all ends every session of the user', async () => {
    const a = await login('all@example.com');
    await redis.del('v_cooldown:all@example.com');
    const b = await login('all@example.com');

    await api().post('/api/auth/logout-all').set('Authorization', `Bearer ${b.accessToken}`).expect(204);

    for (const t of [a, b]) {
      await api().get('/api/quiz/random').set('Authorization', `Bearer ${t.accessToken}`).expect(401);
      await api().post('/api/auth/refresh').send({ refreshToken: t.refreshToken }).expect(401);
    }
  });
});
