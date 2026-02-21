import { Router } from "express";
import { randomUUID } from "node:crypto";
import config from "../../config";
import RedisService from "../../services/redis";

export function accessTokenRouter(): Router {
    const router = Router();

    router.get("/", async (req, res, next) => {
        const accessToken = randomUUID();

        await RedisService.setAccessToken(accessToken);
        res.status(200).send({
            accessToken: accessToken,
            expires_in: config.accessTokenExpires
        });
        next();
    })

    return router;
}