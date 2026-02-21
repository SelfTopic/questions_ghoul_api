import { Router } from "express";
import RedisClient from "../../services/redis";
import jwt from "jsonwebtoken";
import { UserRepository } from "../../repositories/user";

export function verificationCodeRouter(): Router {
    const router = Router();

    router.post("/", async (req, res, next) => {
        const { email, code } = req.body; 

        const savedCode = await RedisClient.getVerificationCode(email);

        if (!savedCode) {
            return res.status(400).json({ error: "Код просрочен или не запрашивался" });
        }

        if (savedCode !== code) {
            return res.status(400).json({ error: "Неверный код" });
        }

        await RedisClient.deleteVerificationCode(email);
        let user = await UserRepository.findByEmail(email);
        if (!user) {
            user = await UserRepository.create(email);
            console.log(`🆕 Создан новый юзер: ${email}`);
        }

        const token = jwt.sign(
            { userId: user.id, email: user.email }, 
            process.env.JWT_SECRET!,
            { expiresIn: '7d' }
        );
        res.json({ token });
        next(); 
    })

    return router;
}