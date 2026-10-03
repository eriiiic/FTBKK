import { drizzle } from 'drizzle-orm/d1';
import { env } from 'cloudflare:workers';
import * as schema from './schema';

export function getDb(database: D1Database = env.DB) {
  return drizzle(database, { schema });
}

export type Db = ReturnType<typeof getDb>;
