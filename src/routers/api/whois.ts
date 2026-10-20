import { Router } from 'express';
import { z } from 'zod';
import whoisDataService from '../../services/whoisDataService';
import { requireUser, requireUserOrGuest } from '../../middlewares/auth';
import { quizLimiter } from '../../middlewares/rateLimit';
import { HttpError } from '../../errors';
import { parseBody } from '../../validation';

const AnswerSchema = z.object({ id: z.number().int().positive() });

/** "Кто/что это?" quiz mode: media prompt, no question text (see whoisDataService.ts). */
export function whoisRouter(): Router {
  const router = Router();

  router.get('/random', requireUserOrGuest, quizLimiter, (_req, res) => {
    const q = whoisDataService.getRandomWhois();
    if (!q) throw new HttpError(404, 'Вопросы не найдены');

    res.json({ id: q.id, promptMedia: q.promptMedia, answer_options: q.answer_options });
  });

  router.post('/answer', requireUser, quizLimiter, (req, res) => {
    const { id } = parseBody(AnswerSchema, req.body);
    const q = whoisDataService.getById(id);
    if (!q) throw new HttpError(404, 'Вопрос не найден');

    res.json({ id: q.id, answer: q.answer });
  });

  return router;
}
