import path from 'path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './database';

async function main() {
  await migrate(db, { migrationsFolder: path.resolve('drizzle') });
  console.log('✅ Миграции применены');
}

main()
  .catch((err) => {
    console.error('❌ Ошибка миграции:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
