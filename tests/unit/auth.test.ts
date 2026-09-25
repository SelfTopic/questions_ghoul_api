import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

const tokens = vi.hoisted(() => ({ verifyAccessToken: vi.fn(), isValidGuestToken: vi.fn() }));
vi.mock('../../src/services/tokenService', () => tokens);

import { authenticate } from '../../src/middlewares/auth';
import { HttpError } from '../../src/errors';

const GUEST = '33333333-3333-4333-8333-333333333333';

function fakeReq(headers: Record<string, string>) {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { headers: lower, get: (name: string) => lower[name.toLowerCase()] } as unknown as Request;
}

async function run(allowGuest: boolean, headers: Record<string, string>) {
  const req = fakeReq(headers);
  const next = vi.fn() as unknown as NextFunction;
  let error: unknown;
  try {
    await authenticate({ allowGuest })(req, {} as Response, next);
  } catch (err) {
    error = err;
  }
  return { req, next: next as unknown as ReturnType<typeof vi.fn>, error: error as HttpError | undefined };
}

beforeEach(() => {
  vi.clearAllMocks();
  tokens.verifyAccessToken.mockResolvedValue({ userId: 'u1', sessionId: 's1' });
  tokens.isValidGuestToken.mockResolvedValue(true);
});

describe('authenticate', () => {
  it('accepts a valid user token', async () => {
    const { req, next, error } = await run(false, { Authorization: 'Bearer jwt' });
    expect(error).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
    expect(req.auth).toEqual({ type: 'user', userId: 'u1', sessionId: 's1' });
    expect(tokens.verifyAccessToken).toHaveBeenCalledWith('jwt');
  });

  it('rejects an invalid user token', async () => {
    tokens.verifyAccessToken.mockResolvedValue(null);
    const { next, error } = await run(true, { Authorization: 'Bearer bad' });
    expect(error?.status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it.each(['Basic abc', 'Bearer', 'bearer abc', 'Token abc'])('rejects malformed header %j', async (header) => {
    const { error } = await run(true, { Authorization: header });
    expect(error?.status).toBe(401);
  });

  it('rejects both credentials at once (limit bypass regression)', async () => {
    const { error, next } = await run(true, { Authorization: 'Bearer anything', 'X-Temporary-Token': GUEST });
    expect(error?.status).toBe(400);
    expect(next).not.toHaveBeenCalled();
    expect(tokens.verifyAccessToken).not.toHaveBeenCalled();
  });

  it('accepts a valid guest token when allowed', async () => {
    const { req, next } = await run(true, { 'X-Temporary-Token': GUEST });
    expect(next).toHaveBeenCalledOnce();
    expect(req.auth).toEqual({ type: 'guest', token: GUEST });
  });

  it('rejects guest tokens where only users are allowed', async () => {
    const { error } = await run(false, { 'X-Temporary-Token': GUEST });
    expect(error?.status).toBe(401);
    expect(tokens.isValidGuestToken).not.toHaveBeenCalled();
  });

  it('rejects non-UUID guest tokens without hitting Redis', async () => {
    const { error } = await run(true, { 'X-Temporary-Token': 'not-a-uuid' });
    expect(error?.status).toBe(401);
    expect(tokens.isValidGuestToken).not.toHaveBeenCalled();
  });

  it('rejects unknown guest tokens', async () => {
    tokens.isValidGuestToken.mockResolvedValue(false);
    const { error } = await run(true, { 'X-Temporary-Token': GUEST });
    expect(error?.status).toBe(401);
  });

  it('rejects requests without credentials', async () => {
    const { error } = await run(true, {});
    expect(error?.status).toBe(401);
  });

  it('never leaks internal error text', async () => {
    tokens.verifyAccessToken.mockResolvedValue(null);
    const { error } = await run(false, { Authorization: 'Bearer x' });
    expect(error?.message).not.toMatch(/jwt|Error|malformed/i);
  });
});
