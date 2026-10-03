import { defineMiddleware } from 'astro:middleware';
import { redirectFor } from './lib/redirects';
import { requireAdmin } from './lib/auth';

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, search } = context.url;

  const to = redirectFor(pathname);
  if (to) return context.redirect(to.includes('#') ? to : `${to}${search}`, 301);

  // Trailing slash: /events/ -> /events
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return context.redirect(pathname.slice(0, -1) + search, 301);
  }

  if (
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname.startsWith('/api/admin/')
  ) {
    const email = await requireAdmin(context.request);
    if (!email) return new Response('Forbidden', { status: 403 });
    context.locals.adminEmail = email;
    const res = await next();
    try {
      res.headers.set('Cache-Control', 'private, no-store');
    } catch {
      // Immutable headers (e.g. Response.redirect): nothing to cache anyway.
    }
    return res;
  }

  return next();
});
