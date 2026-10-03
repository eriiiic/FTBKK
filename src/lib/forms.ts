import { z } from 'zod';

/** FormData -> plain object (checkboxes "on" -> true, repeated keys -> arrays for listed names). */
export function formToObject(form: FormData, arrays: string[] = []) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) {
    if (v instanceof File) continue;
    if (arrays.includes(k)) {
      ((out[k] ??= []) as string[]).push(v);
    } else {
      out[k] = v === 'on' ? true : v.trim();
    }
  }
  for (const k of arrays) out[k] ??= [];
  return out;
}

export function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    out[key] ??= issue.message;
  }
  return out;
}

export const email = z
  .email('Enter a valid email address.')
  .max(200)
  .transform((s) => s.toLowerCase());
export const optionalText = (max = 200) =>
  z
    .string()
    .max(max)
    .optional()
    .transform((s) => (s ? s : null));
export const optionalUrl = z
  .string()
  .max(300)
  .optional()
  .transform((s) => (s ? (/^https?:\/\//.test(s) ? s : `https://${s}`) : null))
  .pipe(z.url('Enter a valid URL.').nullable());

export function clientIp(request: Request) {
  return request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for') ?? null;
}
