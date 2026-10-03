import { handle } from '@astrojs/cloudflare/handler';
import { runScheduled } from './lib/cron';

export default {
  async fetch(request, env, ctx) {
    return handle(request, env, ctx);
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runScheduled(env, new Date(controller.scheduledTime)));
  },
} satisfies ExportedHandler<Env>;
