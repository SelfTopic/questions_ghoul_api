import { Router } from 'express';
import { z } from 'zod';
import { UserRepository } from '../../repositories/user';
import * as verification from '../../services/verificationService';
import { issueSession } from '../../services/tokenService';
import { HttpError } from '../../errors';
import { emailSchema, parseBody } from '../../validation';

const VerifySchema = z.object({
  email: emailSchema,
  code: z.coerce.string().regex(/^\d{6}$/, 'Код состоит из 6 цифр'),
});

export function verificationCodeRouter(): Router {
  const router = Router();

  router.post('/', async (req, res) => {
    const { email, code } = parseBody(VerifySchema, req.body);

    const result = await verification.checkCode(email, code);
    if (result === 'missing') throw new HttpError(400, 'Код просрочен или не запрашивался');
    if (result === 'wrong') throw new HttpError(400, 'Неверный код');

    const user = await UserRepository.findOrCreate(email);

    res.json(await issueSession(user.id));
  });

  return router;
}
