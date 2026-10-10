import { describe, expect, it } from 'vitest';
import { autoPostSeo, keywordList, postSeo, seoOverride } from '../src/lib/seo';

const post = {
  title: 'Franco-Thai startups in 2026',
  excerpt: null as string | null,
  bodyMd: '## Intro\n\nThe **ecosystem** keeps growing. {{download: report.pdf | Read the report}}',
  seoTitle: null as string | null,
  seoDescription: null as string | null,
  seoKeywords: null as string | null,
};

describe('post SEO', () => {
  it('builds automatic values from the title, text and categories', () => {
    expect(autoPostSeo(post, ['Startups', 'Events'])).toEqual({
      title: 'Franco-Thai startups in 2026',
      description: 'Intro The ecosystem keeps growing.',
      keywords: 'Startups, Events',
    });
  });

  it('keeps the summary as typed, cut at 160 characters', () => {
    const auto = autoPostSeo({ ...post, excerpt: '  Franco-Thai   news ' }, []);
    expect(auto.description).toBe('Franco-Thai news');
    expect(autoPostSeo({ ...post, excerpt: 'a'.repeat(200) }, []).description).toHaveLength(160);
  });

  it('stores only values that differ from the automatic one', () => {
    expect(seoOverride('', 'Title')).toBeNull();
    expect(seoOverride(' Title ', 'Title')).toBeNull();
    expect(seoOverride('Better title', 'Title')).toBe('Better title');
  });

  it('cleans keyword lists', () => {
    expect(keywordList(' AI, ,startups,  ai , Thai  market')).toEqual([
      'AI',
      'startups',
      'Thai market',
    ]);
  });

  it('uses overrides on the public page', () => {
    const seo = postSeo({ ...post, seoTitle: 'Custom', seoKeywords: 'a, b' }, ['Startups']);
    expect(seo.title).toBe('Custom');
    expect(seo.keywords).toEqual(['a', 'b']);
    expect(seo.description).toBe('Intro The ecosystem keeps growing.');
  });
});
