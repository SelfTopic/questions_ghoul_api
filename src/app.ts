import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { accessTokenRouter } from "./routers/api/accessToken";
import { registerRouter } from "./routers/api/register";
import { verificationCodeRouter } from "./routers/api/verify";
import * as rateLimitMiddlewares from './middlewares/rateLimit'
import { quizRouter } from "./routers/api/quiz";

const app = express();
    
app.use(cors());
app.use(helmet());
app.use(compression());
app.use(express.json());

app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const ms = Date.now() - start;
        console.log(`${req.method} ${req.originalUrl} ${res.statusCode} - ${ms}ms`);
    });
    next();
});


app.use('/api/access_token', rateLimitMiddlewares.accessTokenLimiter, accessTokenRouter())
app.use('/api/register', rateLimitMiddlewares.authLimiter, registerRouter())
app.use('/api/verify-code', rateLimitMiddlewares.codeRequestLimiter, verificationCodeRouter())
app.get('/api', (req, res) => {
    res.send({ok: true});
})

app.use('/api/quiz', quizRouter());

app.use((err: any, req: any, res: any, next: any) => {
    console.error('Unhandled error:', err);
    const status = err?.status || 500;
    const message = err?.message || 'Internal Server Error';
    res.status(status).json({ error: message });
});

export default app;