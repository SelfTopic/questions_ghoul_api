import { Router } from 'express';
import { issueGuestToken } from '../../services/tokenService';

export function accessTokenRouter(): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json(await issueGuestToken());
  });

  return router;
}
