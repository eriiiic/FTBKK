import { describe, expect, it } from 'vitest';
import { localLink, renderMarkdown } from '../src/lib/markdown';

describe('localLink', () => {
  it('points old blog posts to the new blog', () => {
    expect(localLink('https://www.french-tech-bangkok.com/post/tech-pulse-q3')).toBe(
      '/blog/tech-pulse-q3',
    );
  });
  it('sends the old contact page to the contact form', () => {
    expect(localLink('https://www.french-tech-bangkok.com/contact-8')).toBe('/about#contact');
  });
  it('maps old event, hashtag and home links', () => {
    expect(
      localLink('https://www.french-tech-bangkok.com/event-details-registration/connect-51'),
    ).toBe('/events/connect-51');
    expect(localLink('https://www.french-tech-bangkok.com/blog/hashtags/Startup')).toBe('/blog');
    expect(localLink('https://www.french-tech-bangkok.com/')).toBe('/');
    expect(localLink('https://french-tech-bangkok.com/events')).toBe('/events');
  });
  it('leaves other links alone', () => {
    expect(localLink('https://example.com/post/x')).toBe('https://example.com/post/x');
    expect(localLink('mailto:a@b.co')).toBe('mailto:a@b.co');
    expect(localLink('#top')).toBe('#top');
    expect(localLink('/media/files/a.pdf')).toBe('/media/files/a.pdf');
  });
  it('reads Wix buttons whose text sits on its own lines as links', () => {
    const html = renderMarkdown(
      "Intro.\n\n[\n\nLet's talk\n\n](https://www.french-tech-bangkok.com/contact-8)\n\nNext.",
    );
    expect(html).toContain('<a href="/about#contact">Let\'s talk</a>');
    expect(html).not.toContain('](');
  });
  it('rewrites links in rendered posts', () => {
    expect(renderMarkdown('[Talk](https://www.french-tech-bangkok.com/contact-8)')).toContain(
      'href="/about#contact"',
    );
  });
});
