import { afterEach, describe, expect, it, vi } from 'vitest';

const baseEnv = { ...process.env };

async function loadConfigWith(overrides: Record<string, string | undefined>) {
  vi.resetModules();
  process.env = { ...baseEnv, ...overrides };
  for (const [k, v] of Object.entries(overrides)) if (v === undefined) delete process.env[k];

  const exit = vi.spyOn(process, 'exit').mockImplementation((() => {
    throw new Error('process.exit');
  }) as never);
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const mod = await import('../../src/config');
    return { config: mod.default, exited: false, output: '' };
  } catch {
    return { config: undefined, exited: exit.mock.calls.length > 0, output: error.mock.calls.flat().join('\n') };
  }
}

afterEach(() => {
  process.env = { ...baseEnv };
  vi.restoreAllMocks();
});

describe('config', () => {
  it('loads the test environment', async () => {
    const { config } = await loadConfigWith({});
    expect(config?.port).toBe(3300);
    expect(config?.trustProxy).toBe(false);
    expect(config?.corsOrigins).toBe('*');
  });

  it('fails fast on a short JWT secret', async () => {
    const { exited, output } = await loadConfigWith({ JWT_SECRET: 'short' });
    expect(exited).toBe(true);
    expect(output).toMatch(/JWT_SECRET/);
  });

  it('fails fast on a missing Redis URL', async () => {
    const { exited, output } = await loadConfigWith({ REDIS_URL: undefined });
    expect(exited).toBe(true);
    expect(output).toMatch(/REDIS_URL/);
  });

  it('forbids the log email transport in production', async () => {
    const { exited, output } = await loadConfigWith({ NODE_ENV: 'production', EMAIL_TRANSPORT: 'log' });
    expect(exited).toBe(true);
    expect(output).toMatch(/EMAIL_TRANSPORT/);
  });

  it('requires SMTP credentials for the smtp transport', async () => {
    const { exited, output } = await loadConfigWith({
      EMAIL_TRANSPORT: 'smtp',
      EMAIL_USER: undefined,
      EMAIL_PASSWORD: undefined,
      EMAIL_SERVICE: undefined,
      SMTP_HOST: undefined,
    });
    expect(exited).toBe(true);
    expect(output).toMatch(/EMAIL_USER/);
    expect(output).toMatch(/EMAIL_PASSWORD/);
  });

  it('accepts a pre-refactor .env (no EMAIL_SERVICE / EMAIL_TRANSPORT) and defaults to gmail', async () => {
    const { config, output } = await loadConfigWith({
      EMAIL_TRANSPORT: undefined,
      EMAIL_SERVICE: undefined,
      SMTP_HOST: undefined,
      EMAIL_USER: 'bot@gmail.com',
      EMAIL_PASSWORD: 'app-password',
    });
    expect(output).toBe('');
    expect(config?.email.transport).toBe('smtp');
    expect(config?.email.service).toBe('gmail');
  });

  it('does not force gmail when SMTP_HOST is set', async () => {
    const { config } = await loadConfigWith({ EMAIL_SERVICE: undefined, SMTP_HOST: 'smtp.example.com' });
    expect(config?.email.service).toBeUndefined();
    expect(config?.email.host).toBe('smtp.example.com');
  });

  it.each([
    ['true', true],
    ['false', false],
    ['1', 1],
    ['loopback, 10.0.0.0/8', 'loopback, 10.0.0.0/8'],
  ])('parses TRUST_PROXY=%j', async (value, expected) => {
    const { config } = await loadConfigWith({ TRUST_PROXY: value });
    expect(config?.trustProxy).toEqual(expected);
  });

  it('splits CORS_ORIGINS', async () => {
    const { config } = await loadConfigWith({ CORS_ORIGINS: 'https://a.com, https://b.com' });
    expect(config?.corsOrigins).toEqual(['https://a.com', 'https://b.com']);
  });
});
