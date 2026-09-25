import { Router } from 'express';
import { z } from 'zod';
import { requireUser } from '../../middlewares/auth';
import { refreshLimiter } from '../../middlewares/rateLimit';
import * as tokens from '../../services/tokenService';
import { parseBody } from '../../validation';

const RefreshSchema = z.object({ refreshToken: z.string().min(1).max(256) });

export function authRouter(): Router {
  const router = Router();

  router.post('/refresh', refreshLimiter, async (req, res) => {
    const { refreshToken } = parseBody(RefreshSchema, req.body);
    res.json(await tokens.rotate(refreshToken));
  });

  router.post('/logout', refreshLimiter, async (req, res) => {
    const { refreshToken } = parseBody(RefreshSchema, req.body);
    await tokens.revokeByRefreshToken(refreshToken);
    res.status(204).end();
  });

  router.post('/logout-all', requireUser, async (req, res) => {
    if (req.auth?.type !== 'user') throw new Error('unreachable');
    await tokens.revokeAllForUser(req.auth.userId);
    res.status(204).end();
  });

  return router;
}
