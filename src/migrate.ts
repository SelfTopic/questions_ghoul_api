import 'dotenv/config';
import path from 'path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

// Deliberately independent of src/config: migrations only need the database,
// so unrelated settings (mail, JWT, Redis) must not block them.
async function main() {
  const url = process.env.POSTGRES_URL;
  if (!url) throw new Error('POSTGRES_URL не задан');

  const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 5000 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: path.resolve('drizzle') });
    console.log('✅ Миграции применены');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('❌ Ошибка миграции:', err);
  process.exitCode = 1;
});
