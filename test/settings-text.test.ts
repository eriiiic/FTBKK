import { describe, expect, it } from 'vitest';
import { cardsFromForm } from '../src/lib/settings';
import { renderMarkdown } from '../src/lib/markdown';

describe('cards from the settings form', () => {
  it('zips the repeated rows and drops empty ones', () => {
    const form = {
      joinTitle: ['A startup', '', 'A partner'],
      joinText: ['It is free.\r\nReally.', '', ' Mail us '],
      joinLink: ['/ecosystem/submit', '', ''],
    };
    expect(cardsFromForm(form, 'join', true)).toEqual([
      { title: 'A startup', text: 'It is free.\nReally.', link: '/ecosystem/submit' },
      { title: 'A partner', text: 'Mail us' },
    ]);
  });

  it('ignores links for cards that have none', () => {
    const form = { pillarTitle: ['Learn'], pillarText: ['Meet people'], pillarLink: ['/x'] };
    expect(cardsFromForm(form, 'pillar')).toEqual([{ title: 'Learn', text: 'Meet people' }]);
  });

  it('copes with a missing field', () => {
    expect(cardsFromForm({}, 'join', true)).toEqual([]);
  });
});

describe('settings text', () => {
  it('keeps paragraphs and single line breaks when asked', () => {
    const html = renderMarkdown('First line\nsecond line\n\nNew paragraph', { breaks: true });
    expect(html).toBe('<p>First line<br />second line</p>\n<p>New paragraph</p>\n');
  });

  it('drops headings left empty', () => {
    expect(renderMarkdown('Text\n\n##\n\nMore')).not.toMatch(/<h2/);
  });
});
