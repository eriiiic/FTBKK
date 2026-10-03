# La French Tech Bangkok website

The new www.french-tech-bangkok.com: Astro on a Cloudflare Worker, with D1, R2 and a private admin.
See `CLAUDE.md` for the stack and commands, and `docs/plan.md` for the full rebuild plan.

```sh
cp .dev.vars.example .dev.vars
npm install
npm run db:migrate:local
npm run dev
```
