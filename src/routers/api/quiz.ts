import { Router, Request, Response, NextFunction } from "express";
import questionsDataService from "../../services/questionsDataService";
import { or, requireAuth, requireTempAuth } from "../../middlewares/auth";
import { tempTokenQuestionLimiter, jwtTokenQuestionLimiter } from "../../middlewares/rateLimit";
import { z } from 'zod';

export function quizRouter(): Router {
    const router = Router();

    const chooseLimiter = (req: Request, res: Response, next: NextFunction) => {
        const auth = (req.headers.authorization as string) || "";
        const temp = req.headers["x-temporary-token"];

        if (auth.startsWith("Bearer ")) {
            return jwtTokenQuestionLimiter(req, res, next as any);
        }

        if (temp) {
            return tempTokenQuestionLimiter(req, res, next as any);
        }

        return next();
    };

    router.get(
        "/random",
        chooseLimiter,
        or(requireAuth, requireTempAuth),
        async (req: Request, res: Response) => {
            const q = questionsDataService.getRandomQuestion();
            if (!q) return res.status(404).json({ error: "Вопросы не найдены" });

            const payload = {
                id: q.id,
                question: q.question,
                answer_options: q.answer_options,
                answer_group: q.answer_group,
            };

            return res.json(payload);
        }
    );

    router.post(
        "/answer",
        jwtTokenQuestionLimiter,
        requireAuth,
        async (req: Request, res: Response, next: NextFunction) => {
            const schema = z.object({ id: z.number().optional(), question: z.string().optional() });

            const parse = schema.safeParse(req.body);
            if (!parse.success) {
                return res.status(400).json({ error: 'Неверные входные данные', details: parse.error.format() });
            }

            const { id, question } = parse.data;

            let q;
            if (typeof id === "number") q = questionsDataService.getById(id);
            else if (typeof question === "string") q = questionsDataService.getByQuestion(question);
            else return res.status(400).json({ error: "Требуется поле id или question" });

            if (!q) return res.status(404).json({ error: "Вопрос не найден" });

            try {
                return res.json({ id: q.id, question: q.question, answer: q.answer, answer_group: q.answer_group });
            } catch (err) {
                return next(err);
            }
        }
    );

    return router;
}