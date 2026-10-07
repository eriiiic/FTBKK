import { describe, expect, it } from 'vitest';
import { pickPartners, pickPhotos, pickStats } from '../src/lib/home';

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

  it('shows up to four numbers, leaving out zeros', () => {
    const stats = pickStats({
      members: 0,
      organisations: 31,
      events: 40,
      people: 418,
      partners: 12,
    });
    expect(stats.map((s) => s.value)).toEqual([31, 40, 418, 12]);
    expect(
      pickStats({ members: 5, organisations: 1, events: 1, people: 1, partners: 1 }),
    ).toHaveLength(4);
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
