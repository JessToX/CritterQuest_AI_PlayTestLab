// Optional Drizzle access. Current record CRUD uses the D1 adapter in db/lab.ts.
import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema.ts';

export function getDb() {
  if (!env.DB) {
    throw new Error(
      'Local D1 binding DB is unavailable. Start the workbench with npm run local.',
    );
  }

  return drizzle(env.DB, { schema });
}
