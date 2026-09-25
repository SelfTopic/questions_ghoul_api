import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import config from '../config';
import * as schema from './models';

export const pool = new Pool({
  connectionString: config.postgresUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const db = drizzle(pool, { schema, logger: config.logSql });
