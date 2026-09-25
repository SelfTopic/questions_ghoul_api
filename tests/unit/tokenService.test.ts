import { beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';

const redis = vi.hoisted(() => ({ exists: vi.fn(), set: vi.fn() }));
vi.mock('../../src/services/redis', () => ({ redis }));
vi.mock('../../src/database', () => ({ db: {}, pool: {} }));

import config from '../../src/config';
import { isValidGuestToken, issueGuestToken, verifyAccessToken } from '../../src/services/tokenService';

const USER = '11111111-1111-4111-8111-111111111111';
const SID = '22222222-2222-4222-8222-222222222222';

function sign(payload: object, options: jwt.SignOptions = {}, secret = config.jwt.secret) {
  return jwt.sign(payload, secret, {
    algorithm: 'HS256',
    subject: USER,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
    expiresIn: 60,
    ...options,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  redis.exists.mockResolvedValue(0);
});

describe('verifyAccessToken', () => {
  it('accepts a valid token and checks its session', async () => {
    await expect(verifyAccessToken(sign({ sid: SID, type: 'access' }))).resolves.toEqual({
      userId: USER,
      sessionId: SID,
    });
    expect(redis.exists).toHaveBeenCalledWith(`revoked_sid:${SID}`);
  });

  it('rejects tokens of revoked sessions', async () => {
    redis.exists.mockResolvedValue(1);
    await expect(verifyAccessToken(sign({ sid: SID, type: 'access' }))).resolves.toBeNull();
  });

  it.each([
    ['unsigned (alg none)', () => jwt.sign({ sid: SID, type: 'access' }, '', { algorithm: 'none', subject: USER })],
    ['wrong secret', () => sign({ sid: SID, type: 'access' }, {}, 'x'.repeat(40))],
    ['wrong audience', () => sign({ sid: SID, type: 'access' }, { audience: 'other' })],
    ['wrong issuer', () => sign({ sid: SID, type: 'access' }, { issuer: 'other' })],
    ['expired', () => sign({ sid: SID, type: 'access' }, { expiresIn: -10 })],
    ['missing type', () => sign({ sid: SID })],
    ['wrong type', () => sign({ sid: SID, type: 'refresh' })],
    ['missing sid', () => sign({ type: 'access' })],
    ['garbage', () => 'not.a.jwt'],
  ])('rejects %s', async (_name, make) => {
    await expect(verifyAccessToken(make())).resolves.toBeNull();
  });
});

describe('guest tokens', () => {
  it('stores a UUID token with a one-hour TTL', async () => {
    const res = await issueGuestToken();
    expect(res.accessToken).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.expiresIn).toBe(3600);
    expect(redis.set).toHaveBeenCalledWith(`a_token:${res.accessToken}`, '1', 'EX', 3600);
  });

  it('checks existence in Redis', async () => {
    redis.exists.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    await expect(isValidGuestToken('a')).resolves.toBe(true);
    await expect(isValidGuestToken('b')).resolves.toBe(false);
  });
});

describe('token lifetimes', () => {
  it('access is a week, refresh is a month', () => {
    expect(config.tokens.accessTtl).toBe(7 * 24 * 3600);
    expect(config.tokens.refreshTtl).toBe(30 * 24 * 3600);
  });
});
