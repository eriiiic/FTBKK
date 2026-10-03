import { defineMiddleware } from 'astro:middleware';
import { redirectFor } from './lib/redirects';

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, search } = context.url;

  const to = redirectFor(pathname);
  if (to) return context.redirect(to.includes('#') ? to : `${to}${search}`, 301);

  // Trailing slash: /events/ -> /events
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return context.redirect(pathname.slice(0, -1) + search, 301);
  }

  return next();
});
