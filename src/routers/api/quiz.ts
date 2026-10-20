import { Router } from 'express';
import { z } from 'zod';
import questionsDataService from '../../services/questionsDataService';
import { requireUser, requireUserOrGuest } from '../../middlewares/auth';
import { quizLimiter } from '../../middlewares/rateLimit';
import { HttpError } from '../../errors';
import { parseBody } from '../../validation';

const AnswerSchema = z.union([
  z.object({ id: z.number().int().positive() }),
  z.object({ question: z.string().trim().min(1).max(1000) }),
]);

export function quizRouter(): Router {
  const router = Router();

  router.get('/random', requireUserOrGuest, quizLimiter, (_req, res) => {
    const q = questionsDataService.getRandomQuestion();
    if (!q) throw new HttpError(404, 'Вопросы не найдены');

    res.json({
      id: q.id,
      question: q.question,
      answer_options: q.answer_options,
      answer_group: q.answer_group,
    });
  });

  router.post('/answer', requireUser, quizLimiter, (req, res) => {
    const input = parseBody(AnswerSchema, req.body);
    const q =
      'id' in input ? questionsDataService.getById(input.id) : questionsDataService.getByQuestion(input.question);
    if (!q) throw new HttpError(404, 'Вопрос не найден');

    res.json({
      id: q.id,
      question: q.question,
      answer: q.answer,
      answer_group: q.answer_group,
      answerMedia: q.answerMedia,
    });
  });

  return router;
}
