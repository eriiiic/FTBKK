import { defineConfig } from 'drizzle-kit';

// Migrations are generated here and applied with wrangler (see package.json db:* scripts).
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './migrations',
});
