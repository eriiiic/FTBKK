/** Old Wix URLs (and moved admin screens) -> new URLs (301). Order matters: first match wins. */
const RULES: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^\/post\/([^/]+)\/?$/, (m) => `/blog/${m[1]}`],
  [/^\/blog\/categories\/([^/]+)\/?$/, (m) => `/blog/category/${m[1]}`],
  [/^\/event-details-registration\/([^/]+)(?:\/.*)?$/, (m) => `/events/${m[1]}`],
  [/^\/event-details\/([^/]+)(?:\/.*)?$/, (m) => `/events/${m[1]}`],
  [/^\/sponsors\/([^/]+)\/?$/, (m) => `/ecosystem/${m[1]}`],
  [/^\/(sponsors|services-9|team|members|members-area)(\/.*)?$/, () => '/ecosystem'],
  [/^\/profile\/.*$/, () => '/ecosystem'],
  [/^\/fund\/?$/, () => '/about'],
  [/^\/(contact|contact-us|contact-\d+)\/?$/, () => '/about#contact'],
  [/^\/blog\/hashtags\/.*$/, () => '/blog'],
  // Admin screens moved when the menu was regrouped (Reports group, Oct 2026).
  [/^\/admin\/events\/stats\/?$/, () => '/admin/reports/events'],
  [/^\/admin\/reports\/?$/, () => '/admin/reports/members'],
];

export function redirectFor(pathname: string): string | null {
  for (const [re, to] of RULES) {
    const m = pathname.match(re);
    if (m) return to(m);
  }
  return null;
}
