import { Router } from 'express';
import { z } from 'zod';
import trueFalseDataService from '../../services/trueFalseDataService';
import { requireUser, requireUserOrGuest } from '../../middlewares/auth';
import { quizLimiter } from '../../middlewares/rateLimit';
import { HttpError } from '../../errors';
import { parseBody } from '../../validation';

const AnswerSchema = z.object({ id: z.number().int().positive() });

/** "Утверждение -> верно?" quiz mode (see trueFalseDataService.ts). */
export function trueFalseRouter(): Router {
  const router = Router();

  router.get('/random', requireUserOrGuest, quizLimiter, (_req, res) => {
    const q = trueFalseDataService.getRandomTrueFalse();
    if (!q) throw new HttpError(404, 'Вопросы не найдены');

    res.json({ id: q.id, statement: q.statement, promptMedia: q.promptMedia });
  });

  router.post('/answer', requireUser, quizLimiter, (req, res) => {
    const { id } = parseBody(AnswerSchema, req.body);
    const q = trueFalseDataService.getById(id);
    if (!q) throw new HttpError(404, 'Вопрос не найден');

    res.json({ id: q.id, correct: q.correct });
  });

  return router;
}
