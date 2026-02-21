import { Router } from "express";
import { z } from 'zod';
import Emailer from "../../services/emailer";
import RedisService from "../../services/redis";

const SendCodeSchema = z.object({
  email: z.string().email({ message: "Некорректный формат email" })
});

export function registerRouter() {
    const router = Router();

    router.post('/', async (req, res, next) => {
        try {
            const validatedData = SendCodeSchema.parse(req.body);
            
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            
            const isSent = await Emailer.sendCodeToEmail(validatedData.email, code);

            await RedisService.setVerificationCode(validatedData.email, code)
            
            if (!isSent) 
                return res.status(500).json({ error: "Ошибка почтового сервиса" });

            res.json({ message: "Код отправлен, проверьте свою почту и закончите регистрацию." });
            next();

        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ 
                    error: "Ошибка валидации", 
                    details: error.message.split("message")[1]
                });
            }
            res.status(500).json({ error: "Внутренняя ошибка сервера" });
        }
    });
    return router;
};
