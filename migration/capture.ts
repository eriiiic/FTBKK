/**
 * Phase 1: capture the live Wix site so we never need Wix again.
 *
 *   npx playwright install chromium   # first time only
 *   npm run capture                   # everything
 *   npm run capture -- --only=events  # one type (pages, events, posts, sponsors, team)
 *   npm run capture -- --no-screens   # skip screenshots
 *
 * Writes (only migration/data/** and docs/design-tokens.md are committed):
 *   migration/data/urls.json, events.json, posts.json, organisations.json, people.json,
 *   pages.json, images.json, tokens.json   extracted content
 *   migration/raw/<type>/<slug>.html       rendered HTML
 *   migration/screenshots/<type>/<slug>-{1440,390}.png
 *   migration/images/<type>/<file>         original-resolution images
 *   migration/files/<file>                 PDFs attached to posts
 *   docs/design-tokens.md                  computed palette and type scale
 */
import { chromium, type Browser, type Page } from 'playwright';
import TurndownService from 'turndown';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const SITE = process.env.CAPTURE_SITE || 'https://www.french-tech-bangkok.com';
const ROOT = path.resolve(import.meta.dirname);
const DATA = path.join(ROOT, 'data');
const args = new Set(process.argv.slice(2));
const only = [...args].find((a) => a.startsWith('--only='))?.split('=')[1];
const screens = !args.has('--no-screens');

type UrlType = 'pages' | 'events' | 'posts' | 'categories' | 'sponsors' | 'team' | 'members';

const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });
turndown.remove(['script', 'style', 'noscript', 'iframe']);

// ---------- helpers ----------

async function save(file: string, data: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n');
}

function slugOf(url: string) {
  const p = new URL(url).pathname.replace(/\/$/, '');
  return p.split('/').pop() || 'home';
}

/** static.wixstatic.com/media/abc~mv2.jpg/v1/fill/w_300,... -> original file URL */
export function originalWixImage(src: string): string {
  const m = src.match(/https?:\/\/static\.wixstatic\.com\/media\/[^/?#]+/);
  return m ? m[0] : src;
}

async function fetchText(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

function locs(xml: string) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

function typeOfSitemap(sitemapUrl: string): UrlType {
  if (sitemapUrl.includes('event-pages')) return 'events';
  if (sitemapUrl.includes('blog-posts')) return 'posts';
  if (sitemapUrl.includes('blog-categories')) return 'categories';
  if (sitemapUrl.includes('dynamic-sponsors')) return 'sponsors';
  if (sitemapUrl.includes('dynamic-team')) return 'team';
  if (sitemapUrl.includes('member-profiles')) return 'members';
  return 'pages';
}

async function readyPage(page: Page, url: string) {
  // Wix keeps analytics/websocket traffic open, so 'networkidle' may never fire: wait for 'load'
  // and give the network a short, optional settle.
  await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
  // Wix lazy-loads sections: scroll to the bottom in steps, then back up.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 150));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
}

async function jsonLd(page: Page): Promise<Record<string, unknown>[]> {
  const blocks = await page.$$eval('script[type="application/ld+json"]', (els) =>
    els.map((e) => e.textContent || ''),
  );
  const out: Record<string, unknown>[] = [];
  for (const b of blocks) {
    try {
      const v = JSON.parse(b);
      for (const item of Array.isArray(v) ? v : v['@graph'] || [v]) out.push(item);
    } catch {
      /* ignore malformed blocks */
    }
  }
  return out;
}

async function imagesOn(page: Page, scope = 'body'): Promise<string[]> {
  const srcs = await page.$$eval(`${scope} img, ${scope} [style*="wixstatic"]`, (els) =>
    els.flatMap((e) => {
      const img = e as HTMLImageElement;
      const list = [img.currentSrc, img.src, img.getAttribute('data-src') || ''];
      const bg = (e as HTMLElement).style?.backgroundImage?.match(/url\("?([^")]+)"?\)/);
      if (bg) list.push(bg[1]);
      return list;
    }),
  );
  return [
    ...new Set(srcs.filter((s) => s.includes('static.wixstatic.com/media/')).map(originalWixImage)),
  ];
}

async function mainHtml(page: Page, selectors: string[]) {
  for (const s of selectors) {
    const html = await page.$eval(s, (e) => e.innerHTML).catch(() => null);
    if (html && html.length > 200) return html;
  }
  return page.$eval('main, #PAGES_CONTAINER, body', (e) => e.innerHTML);
}

const images: Record<string, string> = {};
function queueImage(url: string | undefined, type: string) {
  if (!url) return undefined;
  const orig = originalWixImage(url);
  if (!images[orig]) {
    const base = decodeURIComponent(orig.split('/').pop() || 'image').replace(/~mv2/, '');
    images[orig] = `${type}/${base}`;
  }
  return images[orig];
}

async function capture(page: Page, type: UrlType, url: string) {
  const slug = slugOf(url);
  await readyPage(page, url);
  await save(path.join(ROOT, 'raw', type, `${slug}.html`), await page.content());
  if (screens) {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(300);
      await mkdir(path.join(ROOT, 'screenshots', type), { recursive: true });
      await page.screenshot({
        path: path.join(ROOT, 'screenshots', type, `${slug}-${width}.png`),
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  return slug;
}

/**
 * Wix collapses long texts (event descriptions) behind a "Show More" button: click every such
 * button until none is left, so the extracted text is the full one.
 */
async function expandCollapsed(page: Page) {
  const label = /^\s*(show|read|see|voir|lire)\s+(more|plus|la suite)\s*$/i;
  for (let round = 0; round < 3; round++) {
    const buttons = page.locator('button, [role="button"]').filter({ hasText: label });
    const n = await buttons.count();
    if (!n) return;
    for (let i = n - 1; i >= 0; i--) {
      await buttons
        .nth(i)
        .click({ timeout: 3_000 })
        .catch(() => {});
    }
    await page.waitForTimeout(600);
  }
}

/**
 * Wix file widgets in blog posts have no link in the HTML: the file is fetched when "Download" is
 * clicked. Click each one and record where the file came from (a download, a new tab or a request
 * to Wix's file storage).
 */
async function fileWidgets(page: Page) {
  const out: { name: string; url: string; file?: string }[] = [];
  const buttons = page
    .locator('article, main')
    .first()
    .getByText(/^\s*Download\b/i);
  const n = await buttons.count();
  for (let i = 0; i < n; i++) {
    const button = buttons.nth(i);
    const name = await button
      .evaluate((el) => {
        let node: Element | null = el;
        for (let k = 0; k < 6 && node; k++) {
          const m = node.textContent?.match(/[\w\-.() ]+\.(pdf|docx?|xlsx?|pptx?|zip)/i);
          if (m) return m[0].trim();
          node = node.parentElement;
        }
        return null;
      })
      .catch(() => null);
    const isFile = (u: string) =>
      /usrfiles\.com|\/ugd\/|\.(pdf|docx?|xlsx?|pptx?|zip)(\?|$)/i.test(u);
    const caught = Promise.race([
      page.waitForEvent('download', { timeout: 15_000 }).then(async (d) => {
        const fileName = name || d.suggestedFilename();
        const rel = `files/${fileName}`;
        await mkdir(path.join(ROOT, 'files'), { recursive: true });
        await d.saveAs(path.join(ROOT, rel));
        return { url: d.url(), file: rel, fileName };
      }),
      page
        .context()
        .waitForEvent('page', { timeout: 15_000 })
        .then(async (tab) => {
          await tab.waitForLoadState('domcontentloaded').catch(() => {});
          const url = tab.url();
          await tab.close();
          return { url };
        }),
      page
        .waitForRequest((r) => isFile(r.url()), { timeout: 15_000 })
        .then((r) => ({ url: r.url() })),
    ]).catch(() => null);
    await button.click({ timeout: 5_000 }).catch(() => {});
    const hit = await caught;
    if (hit?.url && isFile(hit.url)) {
      out.push({
        name: name || decodeURIComponent(hit.url.split('/').pop()?.split('?')[0] || 'file.pdf'),
        url: hit.url,
        ...('file' in hit && hit.file ? { file: hit.file } : {}),
      });
    }
  }
  return out;
}

/**
 * Each blog category page lists only its own posts: read them to know every post's real
 * categories (the post page itself only shows the whole category menu).
 */
async function categoryMap(page: Page, categoryUrls: string[]) {
  const map: Record<string, string[]> = {};
  for (const url of categoryUrls) {
    try {
      await readyPage(page, url);
      const name = decodeEntities(
        (await page.$eval('h1', (e) => e.textContent?.trim() || '').catch(() => '')) ||
          (await page.title()).split('|')[0].trim(),
      );
      const slugs = await page.$$eval(
        '[data-hook="post-list"] a[href*="/post/"], [data-hook*="post-list"] a[href*="/post/"], main a[href*="/post/"]',
        (els) => [...new Set(els.map((e) => (e as HTMLAnchorElement).pathname.split('/').pop()))],
      );
      for (const s of slugs) if (s) (map[s] ??= []).includes(name) || map[s].push(name);
    } catch {
      /* a category page that fails leaves those posts with the old fallback */
    }
  }
  return map;
}

// ---------- extractors ----------

/** Wix's JSON-LD names are HTML-escaped (e.g. &quot;, &amp;). */
function decodeEntities(s: string) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function series(title: string) {
  const t = title.toLowerCase();
  if (t.includes('connect')) return 'French Tech Connect';
  if (t.includes('talk')) return 'French Tech Talk';
  if (t.includes('ai agent')) return 'AI Agent';
  if (t.includes('workshop') || t.includes('atelier')) return 'Workshop';
  return 'Other';
}

async function extractEvent(page: Page, url: string) {
  const slug = slugOf(url);
  await expandCollapsed(page);
  const ld = (await jsonLd(page)).find((x) => String(x['@type']).includes('Event')) || {};
  const loc = (ld.location || {}) as Record<string, any>;
  const title = decodeEntities(String(ld.name || (await page.title()).split('|')[0].trim()));
  const descHtml = await mainHtml(page, [
    '[data-hook="event-description"]',
    '[data-hook="about-section"]',
    '[data-hook="event-details"]',
  ]);
  const start = String(ld.startDate || '');
  const imgs = await imagesOn(page);
  const cover = queueImage(String((ld.image as any)?.url || ld.image || imgs[0] || ''), 'events');
  return {
    slug,
    title,
    junk: slug === 'test-title' || /test.?title/i.test(title),
    series: series(title),
    startsAt: start,
    endsAt: String(ld.endDate || ''),
    timezone: 'Asia/Bangkok',
    venue: String(loc.name || ''),
    address: String(loc.address?.streetAddress || loc.address || ''),
    summary: String(ld.description || ''),
    bodyMd: turndown.turndown(descHtml).trim(),
    cover,
    oldCoverUrl: imgs[0] || null,
    status: start && new Date(start) > new Date() ? 'upcoming' : 'past',
    url,
  };
}

async function extractPost(page: Page, url: string) {
  const slug = slugOf(url);
  const ld = (await jsonLd(page)).find((x) => /BlogPosting|Article/.test(String(x['@type']))) || {};
  const bodyHtml = await mainHtml(page, [
    '[data-hook="post-description"]',
    '[data-id="content-viewer"]',
    'article',
  ]);
  const categories = await page
    .$$eval('[data-hook="category-label-list"] a', (els) => [
      ...new Set(els.map((e) => e.textContent?.trim()).filter(Boolean)),
    ])
    .catch(() => [] as string[]);
  const linked = await page.$$eval('a[href$=".pdf"], a[href*="/ugd/"]', (els) =>
    els.map((e) => ({ name: e.textContent?.trim() || 'file', url: (e as HTMLAnchorElement).href })),
  );
  const widgets: { name: string; url: string; file?: string }[] = await fileWidgets(page);
  const attachments = [...widgets, ...linked.filter((l) => !widgets.some((w) => w.url === l.url))];
  const imgs = await imagesOn(page, 'article');
  return {
    slug,
    title: decodeEntities(String(ld.headline || (await page.title()).split('|')[0].trim())),
    excerpt: String(ld.description || ''),
    author: String((ld.author as any)?.name || ''),
    publishedAt: String(ld.datePublished || ''),
    readTime: await page
      .$eval('[data-hook="time-to-read"]', (e) => e.textContent?.trim())
      .catch(() => null),
    categories,
    cover: queueImage(String((ld.image as any)?.url || imgs[0] || ''), 'posts'),
    bodyMd: turndown.turndown(bodyHtml).trim(),
    images: imgs.map((i) => queueImage(i, 'posts')),
    attachments,
    url,
  };
}

async function extractSponsor(page: Page, url: string) {
  const slug = slugOf(url);
  const texts = await page.$$eval('h1, h2, h3, h4, h5, h6, p, span', (els) =>
    els
      .filter((e) => e.children.length === 0 && (e as HTMLElement).offsetParent !== null)
      .map((e) => e.textContent?.trim() || '')
      .filter((t) => t.length > 1),
  );
  const name = await page
    .$eval('h1, h2', (e) => e.textContent?.trim() || '')
    .catch(() => texts[0] || slug);
  const links = await page.$$eval('a[href]', (els) => [
    ...new Set(els.map((e) => (e as HTMLAnchorElement).href).filter((h) => h.startsWith('http'))),
  ]);
  const website = links.find(
    (l) =>
      !/french-tech-bangkok|wix|instagram|facebook|linkedin\.com\/company\/14602794|youtube|whatsapp/.test(
        l,
      ),
  );
  const linkedin = links.find((l) => l.includes('linkedin.com') && !l.includes('14602794'));
  const imgs = await imagesOn(page);
  const longest = [...texts].sort((a, b) => b.length - a.length)[0] || '';
  return {
    slug,
    name,
    wixCategory: texts.find((t) => /&| and /.test(t) && t.length < 60 && t !== name) || '',
    description: longest,
    texts, // everything visible, to fix extraction by hand if needed
    logo: queueImage(imgs[0], 'orgs'),
    gallery: imgs.slice(1).map((i) => queueImage(i, 'orgs')),
    website: website || null,
    linkedin: linkedin || null,
    links, // every link on the page, to check by hand when website/linkedin are empty
    url,
  };
}

async function extractPage(page: Page, url: string) {
  const sections = await page.$$eval('section, [data-testid="section"]', (els) =>
    els
      .map((s) => ({
        id: s.id,
        text: (s as HTMLElement).innerText.trim(),
      }))
      .filter((s) => s.text),
  );
  const imgs = await imagesOn(page);
  imgs.forEach((i) => queueImage(i, 'pages'));
  const links = await page.$$eval('a[href]', (els) => [
    ...new Set(els.map((e) => (e as HTMLAnchorElement).href)),
  ]);
  return {
    slug: slugOf(url),
    url,
    title: await page.title(),
    description: await page
      .$eval('meta[name="description"]', (e) => e.getAttribute('content'))
      .catch(() => null),
    sections,
    images: imgs,
    links,
  };
}

/** Board members and institutional representatives: name + photo cards on home/about. */
async function extractPeople(page: Page) {
  return page.$$eval('img', (imgs) =>
    imgs
      .map((img) => {
        const card =
          img.closest('[data-testid="richTextElement"]')?.parentElement ||
          img.closest('div[id^="comp-"]')?.parentElement;
        const text = (card as HTMLElement | null)?.innerText?.trim() || '';
        const linkedin =
          (card?.querySelector('a[href*="linkedin.com/in"]') as HTMLAnchorElement | null)?.href ||
          null;
        return { photo: img.currentSrc || img.src, alt: img.alt, text, linkedin };
      })
      .filter((p) => p.text && p.text.length < 200),
  );
}

// ---------- design tokens ----------

async function extractTokens(page: Page) {
  return page.evaluate(() => {
    const pick = (sel: string) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) return null;
      const s = getComputedStyle(el);
      return {
        selector: sel,
        fontFamily: s.fontFamily,
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        lineHeight: s.lineHeight,
        letterSpacing: s.letterSpacing,
        textTransform: s.textTransform,
        color: s.color,
        background: s.backgroundColor,
        borderRadius: s.borderRadius,
        padding: s.padding,
      };
    };
    const vars: Record<string, string> = {};
    for (const sheet of [...document.styleSheets]) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      for (const r of [...rules]) {
        const st = (r as CSSStyleRule).style;
        if (!st) continue;
        for (const prop of [...st]) {
          if (/^--(color|font|wst)/.test(prop)) vars[prop] = st.getPropertyValue(prop).trim();
        }
      }
    }
    const colorCount: Record<string, number> = {};
    for (const el of [...document.querySelectorAll<HTMLElement>('body *')].slice(0, 4000)) {
      const s = getComputedStyle(el);
      for (const c of [s.color, s.backgroundColor, s.borderTopColor]) {
        if (c && c !== 'rgba(0, 0, 0, 0)') colorCount[c] = (colorCount[c] || 0) + 1;
      }
    }
    const fonts = [
      ...new Set([...document.fonts].map((f) => `${f.family} ${f.weight} ${f.style}`)),
    ];
    return {
      elements: [
        'body',
        'h1',
        'h2',
        'h3',
        'p',
        'nav a, [data-testid="linkElement"]',
        'button, [data-testid="buttonElement"]',
        'header, #SITE_HEADER',
        'footer, #SITE_FOOTER',
      ].map(pick),
      vars,
      colors: Object.entries(colorCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 25),
      fonts,
    };
  });
}

function rgbToHex(rgb: string) {
  const m = rgb.match(/\d+(\.\d+)?/g);
  if (!m) return rgb;
  if (m.length === 4 && Number(m[3]) === 0) return 'transparent';
  return (
    '#' +
    m
      .slice(0, 3)
      .map((n) => Number(n).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

async function writeTokensDoc(tokens: Record<string, Awaited<ReturnType<typeof extractTokens>>>) {
  const lines = [
    '# Design tokens',
    '',
    `Extracted from the live Wix site by \`npm run capture\` on ${new Date().toISOString().slice(0, 10)}.`,
    'Raw values are in `migration/data/tokens.json`. The Tailwind theme in `src/styles/global.css` maps these.',
    '',
  ];
  for (const [pageName, t] of Object.entries(tokens)) {
    lines.push(
      `## ${pageName}`,
      '',
      '### Most used colors',
      '',
      '| Color | Hex | Uses |',
      '| --- | --- | --- |',
    );
    for (const [c, n] of t.colors) lines.push(`| ${c} | ${rgbToHex(c)} | ${n} |`);
    lines.push(
      '',
      '### Elements',
      '',
      '| Element | Font | Size / weight / line-height | Color | Background | Radius |',
      '| --- | --- | --- | --- | --- | --- |',
    );
    for (const e of t.elements.filter(Boolean)) {
      lines.push(
        `| \`${e!.selector}\` | ${e!.fontFamily.split(',')[0]} | ${e!.fontSize} / ${e!.fontWeight} / ${e!.lineHeight} | ${rgbToHex(e!.color)} | ${rgbToHex(e!.background)} | ${e!.borderRadius} |`,
      );
    }
    lines.push('', '### Fonts loaded', '', ...t.fonts.map((f) => `- ${f}`), '');
    const vars = Object.entries(t.vars);
    if (vars.length) {
      lines.push(
        '### Wix CSS variables',
        '',
        ...vars.slice(0, 60).map(([k, v]) => `- \`${k}\`: ${v}`),
        '',
      );
    }
  }
  await save(path.resolve(ROOT, '..', 'docs', 'design-tokens.captured.md'), lines.join('\n'));
}

// ---------- images ----------

async function downloadImages() {
  let ok = 0;
  const failed: string[] = [];
  for (const [url, rel] of Object.entries(images)) {
    const file = path.join(ROOT, 'images', rel);
    if (existsSync(file)) {
      ok++;
      continue;
    }
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, Buffer.from(await res.arrayBuffer()));
      ok++;
    } catch (e) {
      failed.push(`${url} (${(e as Error).message})`);
    }
  }
  return { ok, failed };
}

// ---------- main ----------

async function main() {
  const index = await fetchText(`${SITE}/sitemap.xml`);
  const urls: Record<UrlType, string[]> = {
    pages: [],
    events: [],
    posts: [],
    categories: [],
    sponsors: [],
    team: [],
    members: [],
  };
  for (const sm of locs(index)) urls[typeOfSitemap(sm)].push(...locs(await fetchText(sm)));
  await save(path.join(DATA, 'urls.json'), urls);
  console.log(
    Object.entries(urls)
      .map(([k, v]) => `${k}: ${v.length}`)
      .join(', '),
  );

  const browser: Browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  // tsx (esbuild keepNames) wraps functions in __name(); define it inside the page too.
  await page.addInitScript('window.__name = (f) => f');
  const want = (t: string) => !only || only === t;
  const errors: string[] = [];
  const run = async <T>(type: UrlType, list: string[], fn: (u: string) => Promise<T>) => {
    const out: T[] = [];
    for (const u of list) {
      try {
        await capture(page, type, u);
        out.push(await fn(u));
        process.stdout.write('.');
      } catch (e) {
        errors.push(`${u}: ${(e as Error).message}`);
        process.stdout.write('x');
      }
    }
    console.log(` ${type} ${out.length}/${list.length}`);
    return out;
  };

  if (want('pages')) {
    const pages = await run('pages', urls.pages, (u) => extractPage(page, u));
    const people: Record<string, unknown> = {};
    const tokens: Record<string, Awaited<ReturnType<typeof extractTokens>>> = {};
    for (const p of ['/', '/about', '/events', '/blog']) {
      await readyPage(page, SITE + p);
      tokens[p] = await extractTokens(page);
      if (p === '/' || p === '/about') people[p] = await extractPeople(page);
    }
    await save(path.join(DATA, 'pages.json'), pages);
    await save(path.join(DATA, 'people.captured.json'), people);
    await save(path.join(DATA, 'tokens.json'), tokens);
    await writeTokensDoc(tokens);
  }
  if (want('events')) {
    const events = await run('events', urls.events, (u) => extractEvent(page, u));
    if (events[0]) {
      await readyPage(page, events[0].url);
      const t = await extractTokens(page);
      await save(path.join(DATA, 'tokens.event.json'), t);
    }
    await save(path.join(DATA, 'events.json'), events);
  }
  if (want('posts')) {
    const posts = await run('posts', urls.posts, (u) => extractPost(page, u));
    const cats = await categoryMap(page, urls.categories);
    for (const p of posts) {
      if (cats[p.slug]?.length) p.categories = cats[p.slug];
    }
    console.log(
      `categories: ${Object.keys(cats).length} posts mapped from ${urls.categories.length} category pages`,
    );
    for (const p of posts) {
      for (const a of p.attachments as { name: string; url: string; file?: string }[]) {
        if (a.file) continue;
        try {
          const res = await fetch(a.url);
          if (!res.ok) throw new Error(String(res.status));
          // Keep the name readers saw on Wix ("Thailand_Tech_Pulse_Q3_2026.pdf") over Wix's file id.
          const name = /\.\w{2,4}$/.test(a.name)
            ? a.name
            : decodeURIComponent(a.url.split('/').pop()?.split('?')[0] || 'file.pdf');
          await save(path.join(ROOT, 'files', name), Buffer.from(await res.arrayBuffer()) as never);
          Object.assign(a, { file: `files/${name}` });
        } catch (e) {
          errors.push(`attachment ${a.url}: ${(e as Error).message}`);
        }
      }
    }
    await save(path.join(DATA, 'posts.json'), posts);
  }
  if (want('sponsors')) {
    const orgs = await run('sponsors', urls.sponsors, (u) => extractSponsor(page, u));
    await save(path.join(DATA, 'organisations.json'), orgs);
  }
  if (want('team')) {
    await run('team', urls.team, (u) => extractPage(page, u));
  }

  // Logo and favicon.
  await readyPage(page, SITE);
  const favicon = await page
    .$eval('link[rel*="icon"]', (e) => (e as HTMLLinkElement).href)
    .catch(() => null);
  if (favicon) images[favicon] = 'brand/favicon' + path.extname(new URL(favicon).pathname);
  const logo = await page
    .$eval('header img, #SITE_HEADER img', (e) => (e as HTMLImageElement).src)
    .catch(() => null);
  if (logo) queueImage(logo, 'brand');
  await browser.close();

  const prev = existsSync(path.join(DATA, 'images.json'))
    ? JSON.parse(await readFile(path.join(DATA, 'images.json'), 'utf8'))
    : {};
  Object.assign(images, prev, images);
  await save(path.join(DATA, 'images.json'), images);
  const dl = await downloadImages();
  console.log(`images: ${dl.ok} saved, ${dl.failed.length} failed`);
  await save(path.join(DATA, 'capture-log.json'), {
    at: new Date().toISOString(),
    errors,
    imageFailures: dl.failed,
  });
  if (errors.length) console.log(`${errors.length} errors, see migration/data/capture-log.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
