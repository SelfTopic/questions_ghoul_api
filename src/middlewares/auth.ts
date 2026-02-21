// middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import RedisService from "../services/redis";

interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string }; 
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Токен отсутствует или имеет неверный формат. Используйте заголовок: Authorization: Bearer <token>'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; email: string };

    req.user = decoded;

    next();
  } catch (err) {
    return res.status(401).json({
      error: `Недействительный или просроченный токен: ${err}`
    });
  }
}

export function requireTempAuth(req: Request, res: Response, next: NextFunction) {
  (async () => {
    try {
      const token = req.headers['x-temporary-token'] as string | undefined;
      if (!token) {
        return res.status(401).json({
          error: 'Токен отсутствует или имеет неверный формат. Используйте заголовок: X-Temporary-Token: <token>'
        });
      }

      const stored = await RedisService.getAccessToken(token);
      if (!stored) {
        return res.status(401).json({ error: 'Недействительный или просроченный временный токен.' });
      }

      return next();
    } catch (err) {
      return res.status(401).json({ error: `Недействительный или просроченный токен: ${err}` });
    }
  })();
};

export const or = (jwtMiddleware = requireAuth, tempMiddleware = requireTempAuth) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // If temporary token header is present, try temp first, otherwise try JWT first.
    const hasTemp = !!req.headers['x-temporary-token'];

    const tryJwt = () => {
      jwtMiddleware(req as any, res as any, (err1?: any) => {
        if (!err1) return next();
        next(new Error('Ни одна проверка не пройдена'));
      });
    };

    const tryTemp = () => {
      tempMiddleware(req as any, res as any, (err2?: any) => {
        if (!err2) return next();
        tryJwt();
      });
    };

    if (hasTemp) tryTemp();
    else tryJwt();
  };
};


