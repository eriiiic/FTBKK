import { describe, expect, it } from 'vitest';
import {
  carouselGroups,
  highlightParts,
  homePartners,
  partnerLogos,
  pickPhotos,
} from '../src/lib/home';
import { DEFAULT_PARTNER_GROUPS, editPartnerGroups, partnerGroups } from '../src/lib/directory';

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

  it("takes each partner's logo from the directory organisation with the same website or name", () => {
    const partners = partnerLogos(
      [
        { title: 'Business France', link: 'https://www.businessfrance.fr/' },
        { title: 'Bpifrance', link: 'https://www.bpifrance.fr/' },
        { title: 'La French Tech' },
      ],
      [
        { name: 'Business France Thailand', logoKey: 'l/bf.png', url: 'https://businessfrance.fr' },
        { name: 'la french tech', logoKey: 'l/ft.png', url: null },
      ],
    );
    expect(partners.map((p) => p.logo)).toEqual(['/media/l/bf.png', null, '/media/l/ft.png']);
    expect(partners[1]).toMatchObject({ name: 'Bpifrance', url: 'https://www.bpifrance.fr/' });
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

describe('partners', () => {
  const org = (
    name: string,
    partnerType: string | null,
    partnerOrder = 0,
    partnerHome = false,
  ) => ({
    name,
    partnerType,
    partnerOrder,
    partnerHome,
    logoKey: `l/${name}.png`,
    url: null,
  });

  it('groups partners by type in the set order, then by their order and name', () => {
    const groups = partnerGroups(
      [
        org('Zeta VC', 'investor'),
        org('Hub', 'coworking'),
        org('Alpha VC', 'investor', 2),
        org('Beta VC', 'investor'),
        org('Startup', null),
        org('Embassy', 'institutional'),
        org('Hotel', 'hospitality'),
      ],
      DEFAULT_PARTNER_GROUPS,
    );
    expect(groups.map((g) => g.key)).toEqual([
      'institutional',
      'investor',
      'coworking',
      'hospitality',
    ]);
    expect(groups[1]!.items.map((o) => o.name)).toEqual(['Beta VC', 'Zeta VC', 'Alpha VC']);
  });

  it('shows the partners ticked for Home, else the older list', () => {
    const shown = homePartners(
      [org('Bpifrance', 'institutional', 2, true), org('Embassy', 'institutional', 1, true)],
      [{ title: 'Ignored' }],
    );
    expect(shown.map((p) => p.name)).toEqual(['Embassy', 'Bpifrance']);
    expect(shown[0]!.logo).toBe('/media/l/Embassy.png');
    const fallback = homePartners([org('Bpifrance', 'institutional')], [{ title: 'Bpifrance' }]);
    expect(fallback).toEqual([{ name: 'Bpifrance', url: null, logo: '/media/l/Bpifrance.png' }]);
  });

  it('renames, reorders, adds and removes groups, but keeps a group that has partners', () => {
    const current = [
      { key: 'investor', label: 'Investors', blurb: '' },
      { key: 'hospitality', label: 'Hospitality', blurb: '' },
      { key: 'media', label: 'Media', blurb: '' },
    ];
    const row = (key: string, label: string, remove = false) => ({ key, label, blurb: '', remove });
    const result = editPartnerGroups(
      [
        row('hospitality', 'Hotels and restaurants'),
        row('investor', 'Investors'),
        row('media', 'Media', true),
        row('', 'Investors'),
        row('', ''),
      ],
      current,
      new Set(['investor']),
    );
    expect(result).toEqual({
      groups: [
        { key: 'hospitality', label: 'Hotels and restaurants', blurb: '' },
        { key: 'investor', label: 'Investors', blurb: '' },
        { key: 'investors', label: 'Investors', blurb: '' },
      ],
    });
    expect(
      editPartnerGroups([row('investor', 'Investors', true)], current, new Set(['investor'])),
    ).toEqual({
      error: '"Investors" still has partners: move them to another group before removing it.',
    });
  });
});
