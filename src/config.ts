import 'dotenv/config';
import { z } from 'zod';

const booleanFromEnv = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

// Express accepts boolean, hop count or a list of trusted subnets/presets.
const trustProxyFromEnv = z.string().transform((v): boolean | number | string => {
  if (v === 'true') return true;
  if (v === 'false' || v === '') return false;
  if (/^\d+$/.test(v)) return Number(v);
  return v;
});

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    HOST: z.string().default('0.0.0.0'),
    PORT: z.coerce.number().int().positive().default(3300),
    TRUST_PROXY: trustProxyFromEnv.default(false),
    CORS_ORIGINS: z.string().default('*'),

    JWT_SECRET: z.string().min(32, 'JWT_SECRET должен быть не короче 32 символов'),

    POSTGRES_URL: z.url(),
    REDIS_URL: z.url(),
    LOG_SQL: booleanFromEnv.default(false),

    QUESTIONS_PATH: z.string().default('assets/data/processed/data.json'),

    EMAIL_TRANSPORT: z.enum(['smtp', 'log']).default('smtp'),
    EMAIL_SERVICE: z.string().optional(),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().optional(),
    SMTP_SECURE: booleanFromEnv.optional(),
    EMAIL_USER: z.string().optional(),
    EMAIL_PASSWORD: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.EMAIL_TRANSPORT === 'log' && env.NODE_ENV === 'production') {
      ctx.addIssue({ code: 'custom', path: ['EMAIL_TRANSPORT'], message: 'log-транспорт запрещён в production' });
    }
    if (env.EMAIL_TRANSPORT === 'smtp') {
      if (!env.EMAIL_USER) ctx.addIssue({ code: 'custom', path: ['EMAIL_USER'], message: 'обязателен для smtp' });
      if (!env.EMAIL_PASSWORD)
        ctx.addIssue({ code: 'custom', path: ['EMAIL_PASSWORD'], message: 'обязателен для smtp' });
    }
  });

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Некорректная конфигурация окружения:\n' + z.prettifyError(parsed.error));
  process.exit(1);
}
const env = parsed.data;

const HOUR = 60 * 60 * 1000;

const config = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  host: env.HOST,
  port: env.PORT,
  trustProxy: env.TRUST_PROXY,
  corsOrigins: env.CORS_ORIGINS === '*' ? '*' : env.CORS_ORIGINS.split(',').map((s) => s.trim()),

  postgresUrl: env.POSTGRES_URL,
  redisUrl: env.REDIS_URL,
  logSql: env.LOG_SQL,

  questionsPath: env.QUESTIONS_PATH,

  jwt: {
    secret: env.JWT_SECRET,
    issuer: 'questions-ghoul-api',
    audience: 'questions-ghoul-api',
  },

  // Seconds.
  tokens: {
    accessTtl: 7 * 24 * 60 * 60,
    refreshTtl: 30 * 24 * 60 * 60,
    guestTtl: 60 * 60,
  },

  verification: {
    codeTtl: 5 * 60,
    maxAttempts: 5,
    resendCooldown: 60,
  },

  rateLimits: {
    globalPerIp: { windowMs: 60 * 1000, limit: 120 },
    registerPerIp: { windowMs: HOUR, limit: 10 },
    registerPerEmail: { windowMs: HOUR, limit: 5 },
    verifyPerIp: { windowMs: HOUR, limit: 30 },
    guestTokenPerIp: { windowMs: HOUR, limit: 1 },
    refreshPerIp: { windowMs: HOUR, limit: 60 },
    quizGuest: { windowMs: HOUR, limit: 10 },
    quizUser: { windowMs: HOUR, limit: 1000 },
  },

  email: {
    transport: env.EMAIL_TRANSPORT,
    // Gmail was the only option before EMAIL_SERVICE/SMTP_HOST existed; keep old .env files working.
    service: env.EMAIL_SERVICE ?? (env.SMTP_HOST ? undefined : 'gmail'),
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    user: env.EMAIL_USER,
    password: env.EMAIL_PASSWORD,
    from: env.EMAIL_FROM ?? `"Questions Ghoul API" <${env.EMAIL_USER}>`,
  },
};

export default config;
