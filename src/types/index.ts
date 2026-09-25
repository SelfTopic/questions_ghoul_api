export type AuthContext = { type: 'user'; userId: string; sessionId: string } | { type: 'guest'; token: string };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export {};
