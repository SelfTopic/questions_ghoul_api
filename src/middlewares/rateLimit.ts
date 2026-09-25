import { RedisStore, type RedisReply } from 'rate-limit-redis';
import rateLimit, { ipKeyGenerator, type Options } from 'express-rate-limit';
import type { Request } from 'express';
import config from '../config';
import { redis } from '../services/redis';

const limits = config.rateLimits;

const ipKey = (req: Request) => ipKeyGenerator(req.ip ?? 'unknown');

function limiter(prefix: string, options: Partial<Options>) {
  return rateLimit({
    store: new RedisStore({
      sendCommand: (command: string, ...args: string[]) => redis.call(command, ...args) as Promise<RedisReply>,
      prefix: `rl:${prefix}:`,
    }),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: ipKey,
    message: { error: 'Слишком много запросов. Попробуйте позже.' },
    ...options,
  });
}

const bodyEmail = (req: Request): string | undefined =>
  typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : undefined;

/** Flood protection for every /api request, before any auth work. */
export const globalLimiter = limiter('global', limits.globalPerIp);

export const registerIpLimiter = limiter('register_ip', limits.registerPerIp);

export const registerEmailLimiter = limiter('register_email', {
  ...limits.registerPerEmail,
  skip: (req) => !bodyEmail(req),
  keyGenerator: (req) => bodyEmail(req)!,
});

export const verifyLimiter = limiter('verify', limits.verifyPerIp);

export const guestTokenLimiter = limiter('guest_token', limits.guestTokenPerIp);

export const refreshLimiter = limiter('refresh', limits.refreshPerIp);

/** Must run after authenticate(): keyed by the verified user id or guest token, never by raw headers. */
export const quizLimiter = limiter('quiz', {
  windowMs: limits.quizUser.windowMs,
  limit: (req) => (req.auth?.type === 'user' ? limits.quizUser.limit : limits.quizGuest.limit),
  keyGenerator: (req) => {
    const auth = req.auth;
    if (!auth) throw new Error('quizLimiter должен идти после authenticate()');
    return auth.type === 'user' ? `user:${auth.userId}` : `guest:${auth.token}`;
  },
});
