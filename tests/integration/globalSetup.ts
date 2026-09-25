import path from 'path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

export default async function setup() {
  const { db, pool } = await import('../../src/database');
  await migrate(db, { migrationsFolder: path.resolve('drizzle') });
  await pool.end();
}
