import { defineMiddleware } from 'astro:middleware';
import { redirectFor } from './lib/redirects';
import { checkAdmin } from './lib/auth';

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
    const check = await checkAdmin(context.request);
    if (!('email' in check)) {
      // Plain text so nothing from the token can render as HTML; the reason helps fix Access setup.
      console.warn('[auth] admin refused:', check.reason);
      return new Response(`Forbidden\n\n${check.reason}\n`, {
        status: 403,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }
    context.locals.adminEmail = check.email;
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
