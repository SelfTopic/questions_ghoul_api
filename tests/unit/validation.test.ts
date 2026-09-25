import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { emailSchema, parseBody } from '../../src/validation';
import { HttpError } from '../../src/errors';

describe('emailSchema', () => {
  it('trims and lowercases', () => {
    expect(emailSchema.parse('  User@Example.COM ')).toBe('user@example.com');
  });

  it.each(['nope', '', 'a@', '@b.c', 'a b@c.d', `${'a'.repeat(250)}@b.cd`])('rejects %j', (value) => {
    expect(emailSchema.safeParse(value).success).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(emailSchema.safeParse(123).success).toBe(false);
  });
});

describe('parseBody', () => {
  const schema = z.object({ name: z.string() });

  it('returns parsed data', () => {
    expect(parseBody(schema, { name: 'x' })).toEqual({ name: 'x' });
  });

  it('throws 400 with field details', () => {
    try {
      parseBody(schema, { name: 1 });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).status).toBe(400);
      expect((err as HttpError).details).toHaveProperty('name');
    }
  });

  it('treats a missing body as an empty object', () => {
    expect(() => parseBody(schema, undefined)).toThrow(HttpError);
  });
});
