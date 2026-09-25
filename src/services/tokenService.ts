import { createHash, randomBytes, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { and, eq, isNull, lt } from 'drizzle-orm';
import config from '../config';
import { db } from '../database';
import { refreshTokens } from '../database/models';
import { redis } from './redis';
import { HttpError } from '../errors';

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshExpiresIn: number;
};

type AccessPayload = { sub: string; sid: string; type: 'access' };

const revokedSessionKey = (sid: string) => `revoked_sid:${sid}`;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

function signAccessToken(userId: string, sessionId: string) {
  return jwt.sign({ sid: sessionId, type: 'access' }, config.jwt.secret, {
    algorithm: 'HS256',
    subject: userId,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
    expiresIn: config.tokens.accessTtl,
  });
}

function newRefreshToken() {
  const token = randomBytes(32).toString('base64url');
  return {
    token,
    hash: hashToken(token),
    expiresAt: new Date(Date.now() + config.tokens.refreshTtl * 1000),
  };
}

function pair(accessToken: string, refreshToken: string): TokenPair {
  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: config.tokens.accessTtl,
    refreshExpiresIn: config.tokens.refreshTtl,
  };
}

/** Access tokens live for a week, so revoked sessions are remembered until their last access token expires. */
async function markSessionsRevoked(sessionIds: string[]) {
  if (sessionIds.length === 0) return;
  const multi = redis.multi();
  for (const sid of sessionIds) multi.set(revokedSessionKey(sid), '1', 'EX', config.tokens.accessTtl);
  await multi.exec();
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function revokeFamily(tx: Tx | typeof db, familyId: string) {
  await tx
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)));
}

/** Starts a new session (token family) for the user. */
export async function issueSession(userId: string): Promise<TokenPair> {
  const sessionId = randomUUID();
  const refresh = newRefreshToken();
  await db.insert(refreshTokens).values({
    userId,
    tokenHash: refresh.hash,
    familyId: sessionId,
    expiresAt: refresh.expiresAt,
  });
  return pair(signAccessToken(userId, sessionId), refresh.token);
}

/**
 * Exchanges a refresh token for a new pair and revokes the old one.
 * Presenting an already rotated token means it leaked: the whole session is revoked.
 */
export async function rotate(refreshToken: string): Promise<TokenPair> {
  const hash = hashToken(refreshToken);

  type RotateResult = { tokens: TokenPair } | { error: 'invalid' } | { error: 'reused'; familyId: string };

  const result = await db.transaction(async (tx): Promise<RotateResult> => {
    const [row] = await tx.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, hash)).for('update');

    if (!row) return { error: 'invalid' };
    if (row.revokedAt) {
      await revokeFamily(tx, row.familyId);
      return { error: 'reused', familyId: row.familyId };
    }
    if (row.expiresAt.getTime() <= Date.now()) return { error: 'invalid' };

    const next = newRefreshToken();
    const [inserted] = await tx
      .insert(refreshTokens)
      .values({ userId: row.userId, tokenHash: next.hash, familyId: row.familyId, expiresAt: next.expiresAt })
      .returning({ id: refreshTokens.id });
    await tx
      .update(refreshTokens)
      .set({ revokedAt: new Date(), replacedBy: inserted.id })
      .where(eq(refreshTokens.id, row.id));

    return { tokens: pair(signAccessToken(row.userId, row.familyId), next.token) };
  });

  if ('tokens' in result) return result.tokens;
  if (result.error === 'reused') {
    await markSessionsRevoked([result.familyId]);
    console.warn(`⚠️ Повторное использование refresh-токена, сессия ${result.familyId} отозвана`);
  }
  throw new HttpError(401, 'Недействительный или просроченный refresh-токен');
}

/** Ends the session the refresh token belongs to. Unknown tokens are ignored. */
export async function revokeByRefreshToken(refreshToken: string) {
  const [row] = await db
    .select({ familyId: refreshTokens.familyId })
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, hashToken(refreshToken)));
  if (!row) return;
  await revokeFamily(db, row.familyId);
  await markSessionsRevoked([row.familyId]);
}

export async function revokeAllForUser(userId: string) {
  const rows = await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)))
    .returning({ familyId: refreshTokens.familyId });
  await markSessionsRevoked([...new Set(rows.map((r) => r.familyId))]);
}

/** Verifies an access JWT and checks its session hasn't been revoked. Returns null when invalid. */
export async function verifyAccessToken(token: string): Promise<{ userId: string; sessionId: string } | null> {
  let payload: AccessPayload;
  try {
    payload = jwt.verify(token, config.jwt.secret, {
      algorithms: ['HS256'],
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    }) as AccessPayload;
  } catch {
    return null;
  }
  if (payload.type !== 'access' || typeof payload.sub !== 'string' || typeof payload.sid !== 'string') return null;
  if (await redis.exists(revokedSessionKey(payload.sid))) return null;
  return { userId: payload.sub, sessionId: payload.sid };
}

export async function deleteExpiredRefreshTokens() {
  await db.delete(refreshTokens).where(lt(refreshTokens.expiresAt, new Date()));
}

export async function issueGuestToken() {
  const token = randomUUID();
  await redis.set(`a_token:${token}`, '1', 'EX', config.tokens.guestTtl);
  return { accessToken: token, expiresIn: config.tokens.guestTtl };
}

export async function isValidGuestToken(token: string) {
  return (await redis.exists(`a_token:${token}`)) === 1;
}
