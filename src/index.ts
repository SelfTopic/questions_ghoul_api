import fs from 'fs';
import config from './config';
import { loadQuestions } from './services/questionsDataService';
import { loadWhois } from './services/whoisDataService';
import { loadTrueFalse } from './services/trueFalseDataService';
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

// Optional quiz mode: a missing file just disables it, but a malformed one
// still crashes the start - it means the feature was actively misconfigured.
if (fs.existsSync(config.whoisPath)) {
  try {
    const count = loadWhois(config.whoisPath);
    console.log(`🖼️ Загружено вопросов "кто это": ${count}`);
  } catch (err) {
    console.error(`❌ ${(err as Error).message}`);
    process.exit(1);
  }
} else {
  console.log('🖼️ Файл "кто это" не найден — режим отключён');
}

if (fs.existsSync(config.trueFalsePath)) {
  try {
    const count = loadTrueFalse(config.trueFalsePath);
    console.log(`✅❌ Загружено утверждений: ${count}`);
  } catch (err) {
    console.error(`❌ ${(err as Error).message}`);
    process.exit(1);
  }
} else {
  console.log('✅❌ Файл утверждений не найден — режим отключён');
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
