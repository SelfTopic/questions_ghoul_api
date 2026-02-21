import { RedisStore, type RedisReply } from 'rate-limit-redis'
import Redis from 'ioredis';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const redisClient = new Redis(process.env.REDIS_URL!);

const createRedisStore = (prefix: string) => new RedisStore({
  sendCommand: (command: string, ...args: string[]) =>
    redisClient.call(command, ...args) as Promise<RedisReply>,
  prefix: prefix
});

export const apiLimiter = rateLimit({
  store: createRedisStore('rl:api:'),
  windowMs: 15 * 60 * 1000,
  max: 150,
  standardHeaders: true,
  keyGenerator: (req) => ipKeyGenerator(req.ip!),
});

export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Слишком много попыток. Подождите 1 час.' },
  keyGenerator: (req) => req.body?.email || ipKeyGenerator(req.ip!),
  store: createRedisStore('rl:auth:'),
  standardHeaders: true,
});

export const codeRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => req.body?.email || ipKeyGenerator(req.ip!),
  store: createRedisStore('rl:code:'),
  standardHeaders: true,
});

export const accessTokenLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 1,
  keyGenerator: (req) => req.body?.email || ipKeyGenerator(req.ip!),
  store: createRedisStore('rl:token:'),
  standardHeaders: true,
});

export const tempTokenQuestionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => {
    const t = (req.headers['x-temporary-token'] as string);
    return t || ipKeyGenerator(req.ip!);
  },
  store: createRedisStore('rl:temp_q:'),
  standardHeaders: true,
  message: { error: 'Слишком много запросов с временным токеном. Попробуйте позже.' },
});

export const jwtTokenQuestionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 1000,
  keyGenerator: (req) => {
    const auth = (req.headers.authorization as string) || '';
    if (auth.startsWith('Bearer ')) return auth.split(' ')[1];
    return ipKeyGenerator(req.ip!);
  },
  store: createRedisStore('rl:jwt_q:'),
  standardHeaders: true,
  message: { error: 'Слишком много запросов. Попробуйте позже.' },
});
