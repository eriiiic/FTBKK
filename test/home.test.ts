import { describe, expect, it } from 'vitest';
import { carouselGroups, highlightParts, pickPartners, pickPhotos } from '../src/lib/home';

describe('home page', () => {
  it('uses the picked photos first, then one photo per recent event, then covers', () => {
    const photos = pickPhotos(
      [{ key: 'home/a.jpg', alt: 'Our crowd' }],
      [
        {
          title: 'Connect #52',
          recap: { photos: [{ key: 'r/1.jpg' }, { key: 'r/2.jpg' }] },
          coverKey: 'c/52.jpg',
        },
        { title: 'Talk', recap: { photos: [{ key: 'r/3.jpg', alt: 'Panel' }] }, coverKey: null },
        { title: 'Old', recap: null, coverKey: 'c/old.jpg' },
      ],
    );
    expect(photos.map((p) => p.src)).toEqual([
      '/media/home/a.jpg',
      '/media/r/1.jpg',
      '/media/r/3.jpg',
      '/media/r/2.jpg',
      '/media/c/52.jpg',
      '/media/c/old.jpg',
    ]);
    expect(photos[0]!.alt).toBe('Our crowd');
    expect(photos[2]!.alt).toBe('Panel');
    expect(photos[1]!.alt).toBe('Connect #52');
  });

  it('lists institutions first, then the most frequent hosts and sponsors with a logo', () => {
    const partners = pickPartners(
      [{ name: 'Embassy', logoKey: 'l/emb.png', url: null }],
      [
        { name: 'Cowork', logoKey: 'l/c.png', url: 'https://c.example' },
        { name: 'Bank', logoKey: 'l/b.png', url: null },
        { name: 'cowork ', logoKey: 'l/c.png', url: null },
        { name: 'No logo', logoKey: null, url: null },
      ],
    );
    expect(partners.map((p) => p.name)).toEqual(['Embassy', 'Cowork', 'Bank']);
  });
});

describe('home page helpers', () => {
  it('picks up to n organisations at random for All and each category', () => {
    const orgs = Array.from({ length: 40 }, (_, i) => ({
      name: `Org ${i}`,
      category: i % 4 === 0 ? 'investor' : 'french_startup',
    }));
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const groups = carouselGroups(orgs, ['french_startup', 'investor', 'school'], 15, rand);
    expect(groups.map((g) => [g.key, g.items.length])).toEqual([
      ['', 15],
      ['french_startup', 15],
      ['investor', 10],
    ]);
    expect(groups[2]!.items.every((o) => o.category === 'investor')).toBe(true);
    // Not simply the first ones in alphabetical order.
    expect(groups[0]!.items.map((o) => o.name)).not.toEqual(orgs.slice(0, 15).map((o) => o.name));
    expect(new Set(groups[0]!.items).size).toBe(15);
  });

  it('marks the starred words of a heading', () => {
    expect(highlightParts('The tech ecosystem connecting *Bangkok*, France')).toEqual([
      { text: 'The tech ecosystem connecting ', mark: false },
      { text: 'Bangkok', mark: true },
      { text: ', France', mark: false },
    ]);
    expect(highlightParts('Plain')).toEqual([{ text: 'Plain', mark: false }]);
  });
});
