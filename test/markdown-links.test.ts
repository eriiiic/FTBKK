import { describe, expect, it } from 'vitest';
import { joinLinkText, renderMarkdown } from '../src/lib/markdown';

describe('Wix button links', () => {
  const md = "Questions?\n\n[\n\nLet's talk\n\n](/about#contact)\n\n![](/media/a.jpg)";

  it('puts link text spread over blank lines on one line', () => {
    expect(joinLinkText(md)).toBe(
      "Questions?\n\n[Let's talk](/about#contact)\n\n![](/media/a.jpg)",
    );
  });

  it('renders them as a real link', () => {
    const html = renderMarkdown(md);
    expect(html).toContain('<a href="/about#contact">Let\'s talk</a>');
    expect(html).not.toContain('](');
  });

  it('leaves ordinary links alone', () => {
    expect(joinLinkText('[a](/b) and [c d](/e)')).toBe('[a](/b) and [c d](/e)');
  });
});
