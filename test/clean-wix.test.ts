import { describe, expect, it } from 'vitest';
import {
  cleanWixMarkdown,
  decodeEntities,
  dropLeadingCoverImage,
  extractByline,
  inlineAttachments,
  postCategories,
} from '../scripts/lib/clean-wix';

describe('cleanWixMarkdown', () => {
  it('drops blank Wix paragraphs, the Show More label and the repeated section title', () => {
    const md = '## About the event\n\nHello  \n\n  \n\n-   one\n    \n-   two  \n    \n\nShow More';
    expect(cleanWixMarkdown(md)).toBe('Hello\n\n-   one\n-   two');
  });
  it('turns hashtag search links into text and old-site links into local ones', () => {
    const md =
      'See [this](https://www.french-tech-bangkok.com/post/abc) and [#FTB](/search/posts?query=%23FTB) now\n\n[#A](/search/posts?query=a) [#B](/search/posts?query=b)';
    expect(cleanWixMarkdown(md)).toBe('See [this](/blog/abc) and #FTB now');
  });
  it('keeps hard line breaks inside a paragraph', () => {
    expect(cleanWixMarkdown('line one  \nline two')).toBe('line one  \nline two');
  });
});

describe('extractByline', () => {
  it('moves the typed byline out of the body', () => {
    const md =
      'Bangkok, Thailand\n\n**By** [_Jane Doe_](https://linkedin.com/in/jd) and [John Roe](https://x)\n\nBoard Members\n\nLa French Tech Bangkok\n\nFirst paragraph.';
    expect(extractByline(md)).toEqual({
      authorName: 'Jane Doe and John Roe',
      authorRole: 'Board Members',
      body: 'First paragraph.',
    });
  });
  it('leaves posts without a byline alone', () => {
    expect(extractByline('Just text.')).toEqual({
      authorName: null,
      authorRole: null,
      body: 'Just text.',
    });
  });
});

describe('inlineAttachments', () => {
  const md = 'Get it here:\n\nReport\\_Q3.pdf\n\nDownload PDF • 403KB\n\n### Next';
  it('links a captured file in place of the Wix widget text', () => {
    expect(inlineAttachments(md, [{ name: 'Report_Q3.pdf', key: 'posts/files/r.pdf' }])).toBe(
      'Get it here:\n\n[Report_Q3.pdf (403KB)](/media/posts/files/r.pdf)\n\n### Next',
    );
  });
  it('keeps only the file name when the file was not captured', () => {
    expect(inlineAttachments(md, [])).toBe('Get it here:\n\nReport_Q3.pdf\n\n### Next');
  });
});

describe('dropLeadingCoverImage', () => {
  it('removes a first image that repeats the cover', () => {
    expect(dropLeadingCoverImage('![](/media/posts/a.jpg)\n\nText', 'posts/a.jpg')).toBe('Text');
    expect(dropLeadingCoverImage('![](/media/posts/b.jpg)\n\nText', 'posts/a.jpg')).toBe(
      '![](/media/posts/b.jpg)\n\nText',
    );
  });
});

describe('decodeEntities', () => {
  it('decodes the entities left in Wix plain text', () => {
    expect(decodeEntities('Speaker &amp; topic &#8211; soon')).toBe('Speaker & topic – soon');
  });
});

describe('long Wix headings', () => {
  it('turns an intro paragraph styled as h5 back into a paragraph', () => {
    const intro = 'x'.repeat(130);
    expect(cleanWixMarkdown(`##### ${intro}\n\n## Real heading`)).toBe(
      `${intro}\n\n## Real heading`,
    );
  });
});

describe('postCategories', () => {
  const all = [
    'Ecosystem News',
    'Founder Guides',
    'Tech Insights',
    'Events & Community',
    'Studies & ressources',
  ];
  it('keeps real categories and sorts posts that came back with the whole menu', () => {
    expect(postCategories('Anything', ['Tech Insights'])).toEqual(['Tech Insights']);
    expect(postCategories('Start a Business in Thailand: Founder’s Guide (Part 1/4)', all)).toEqual(
      ['Founder Guides'],
    );
    expect(postCategories('Thailand Tech Pulse Q3 2026', all)).toEqual([
      'Studies & ressources',
      'Ecosystem News',
    ]);
  });
});
