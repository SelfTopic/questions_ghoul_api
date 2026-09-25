import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { HttpError } from '../errors';
import { isValidGuestToken, verifyAccessToken } from '../services/tokenService';

const guestTokenSchema = z.uuid();

function bearerToken(req: Request) {
  const header = req.headers.authorization;
  if (!header) return undefined;
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw new HttpError(401, 'Используйте заголовок: Authorization: Bearer <token>');
  return token;
}

/**
 * Resolves who is calling and stores it in req.auth.
 * Exactly one credential is accepted: a user JWT (Authorization: Bearer) or,
 * when allowGuest is set, a temporary token (X-Temporary-Token).
 */
export function authenticate({ allowGuest }: { allowGuest: boolean }) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const bearer = bearerToken(req);
    const guest = req.get('x-temporary-token');

    if (bearer && guest) {
      throw new HttpError(400, 'Передайте только один токен: Authorization или X-Temporary-Token');
    }

    if (bearer) {
      const user = await verifyAccessToken(bearer);
      if (!user) throw new HttpError(401, 'Недействительный или просроченный токен');
      req.auth = { type: 'user', ...user };
      return next();
    }

    if (guest && allowGuest) {
      if (!guestTokenSchema.safeParse(guest).success || !(await isValidGuestToken(guest))) {
        throw new HttpError(401, 'Недействительный или просроченный временный токен');
      }
      req.auth = { type: 'guest', token: guest };
      return next();
    }

    throw new HttpError(
      401,
      allowGuest
        ? 'Требуется Authorization: Bearer <token> или X-Temporary-Token: <token>'
        : 'Требуется Authorization: Bearer <token>',
    );
  };
}

export const requireUser = authenticate({ allowGuest: false });
export const requireUserOrGuest = authenticate({ allowGuest: true });
