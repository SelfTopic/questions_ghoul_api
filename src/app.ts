import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { sql } from 'drizzle-orm';
import './types';
import config from './config';
import { db } from './database';
import { redis } from './services/redis';
import { HttpError } from './errors';
import { accessTokenRouter } from './routers/api/accessToken';
import { registerRouter } from './routers/api/register';
import { verificationCodeRouter } from './routers/api/verify';
import { authRouter } from './routers/api/auth';
import { quizRouter } from './routers/api/quiz';
import * as limiters from './middlewares/rateLimit';

const app = express();

app.set('trust proxy', config.trustProxy);
app.use(helmet());
app.use(cors({ origin: config.corsOrigins }));
app.use(compression());
app.use(express.json({ limit: '10kb' }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} - ${Date.now() - start}ms`);
  });
  next();
});

// Before the global limiter so container healthchecks never get throttled.
app.get('/api/health', async (_req, res) => {
  try {
    await Promise.all([redis.ping(), db.execute(sql`select 1`)]);
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

app.use('/api', limiters.globalLimiter);

app.use('/api/access_token', limiters.guestTokenLimiter, accessTokenRouter());
app.use('/api/register', limiters.registerIpLimiter, limiters.registerEmailLimiter, registerRouter());
app.use('/api/verify-code', limiters.verifyLimiter, verificationCodeRouter());
app.use('/api/auth', authRouter());
app.use('/api/quiz', quizRouter());

app.use((_req, _res, next) => next(new HttpError(404, 'Не найдено')));

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...(err.details ? { details: err.details } : {}) });
  }

  // body-parser errors (malformed JSON, payload too large) are safe to expose.
  const e = err as { status?: number; expose?: boolean; message?: string };
  if (e?.expose && e.status && e.status < 500) {
    return res.status(e.status).json({ error: e.message });
  }

  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

export default app;
