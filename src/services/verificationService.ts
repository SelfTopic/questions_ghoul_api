import { randomInt } from 'node:crypto';
import config from '../config';
import { redis } from './redis';

const codeKey = (email: string) => `v_code:${email}`;
const cooldownKey = (email: string) => `v_cooldown:${email}`;

/** Returns false if a code was sent to this email too recently. */
export async function acquireResendCooldown(email: string) {
  const res = await redis.set(cooldownKey(email), '1', 'EX', config.verification.resendCooldown, 'NX');
  return res === 'OK';
}

export async function releaseResendCooldown(email: string) {
  await redis.del(cooldownKey(email));
}

/** Creates a fresh code, replacing any previous one and resetting its attempt counter. */
export async function createCode(email: string) {
  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  await redis
    .multi()
    .del(codeKey(email))
    .hset(codeKey(email), { code, attempts: 0 })
    .expire(codeKey(email), config.verification.codeTtl)
    .exec();
  return code;
}

export async function deleteCode(email: string) {
  await redis.del(codeKey(email));
}

export type CheckResult = 'ok' | 'missing' | 'wrong';

// Atomic so that an expiring key can't be resurrected without TTL and a code can't be used twice.
// Returns 0 = missing, 1 = ok (code consumed), 2 = wrong (attempt burned, deleted after the last one).
const CHECK_SCRIPT = `
local saved = redis.call('HGET', KEYS[1], 'code')
if not saved then return 0 end
if saved == ARGV[1] then
  redis.call('DEL', KEYS[1])
  return 1
end
local attempts = redis.call('HINCRBY', KEYS[1], 'attempts', 1)
if attempts >= tonumber(ARGV[2]) then redis.call('DEL', KEYS[1]) end
return 2
`;

export async function checkCode(email: string, code: string): Promise<CheckResult> {
  const res = await redis.eval(CHECK_SCRIPT, 1, codeKey(email), code, config.verification.maxAttempts);
  if (res === 1) return 'ok';
  if (res === 2) return 'wrong';
  return 'missing';
}
