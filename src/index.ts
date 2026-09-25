import config from './config';
import { loadQuestions } from './services/questionsDataService';
import app from './app';
import { pool } from './database';
import { redis } from './services/redis';
import { deleteExpiredRefreshTokens } from './services/tokenService';

try {
  const count = loadQuestions(config.questionsPath);
  console.log(`📚 Загружено вопросов: ${count}`);
} catch (err) {
  console.error(`❌ ${(err as Error).message}`);
  process.exit(1);
}

const server = app.listen(config.port, config.host, () => {
  console.log(`🚀 Сервер запущен на http://${config.host}:${config.port}`);
});

const cleanup = setInterval(
  () => deleteExpiredRefreshTokens().catch((err) => console.error('Очистка refresh-токенов:', err)),
  60 * 60 * 1000,
);
cleanup.unref();

let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal}: завершение работы...`);

  setTimeout(() => {
    console.error('Не удалось корректно завершиться за 10 с, выход');
    process.exit(1);
  }, 10_000).unref();

  clearInterval(cleanup);
  server.close(async () => {
    await Promise.allSettled([redis.quit(), pool.end()]);
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => console.error('Unhandled rejection:', reason));
