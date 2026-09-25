import { Router } from 'express';
import { z } from 'zod';
import config from '../../config';
import Emailer from '../../services/emailer';
import * as verification from '../../services/verificationService';
import { HttpError } from '../../errors';
import { emailSchema, parseBody } from '../../validation';

const SendCodeSchema = z.object({ email: emailSchema });

export function registerRouter() {
  const router = Router();

  router.post('/', async (req, res) => {
    const { email } = parseBody(SendCodeSchema, req.body);

    if (!(await verification.acquireResendCooldown(email))) {
      res.set('Retry-After', String(config.verification.resendCooldown));
      throw new HttpError(429, 'Код уже отправлен, повторный запрос возможен через минуту.');
    }

    const code = await verification.createCode(email);
    const isSent = await Emailer.sendCodeToEmail(email, code);

    if (!isSent) {
      await verification.deleteCode(email);
      await verification.releaseResendCooldown(email);
      throw new HttpError(503, 'Почтовый сервис временно недоступен');
    }

    res.json({ message: 'Код отправлен, проверьте свою почту и закончите регистрацию.' });
  });

  return router;
}
