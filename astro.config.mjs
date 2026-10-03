// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://www.french-tech-bangkok.com',
  output: 'server',
  // No Astro sessions: admin auth is Cloudflare Access, owners use magic links.
  session: false,
  adapter: cloudflare({
    // Images are served from R2 at /media/*, no on-the-fly transforms.
    imageService: 'passthrough',
  }),
  vite: {
    plugins: [tailwindcss()],
  },
});
