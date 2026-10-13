import { describe, expect, it } from 'vitest';
import { groupNames, knownLabelsOnly, labelsOf, tagKey, tagNames } from '../src/lib/contact-labels';

const labels = labelsOf(
  [
    { key: 'speaker', name: 'Speaker' },
    { key: 'investor', name: 'investor' },
  ],
  [
    { id: 2, name: 'Volunteers', description: null },
    { id: 1, name: 'Board 2027', description: 'Next board' },
  ],
);

describe('contact tags and groups', () => {
  it('sorts by name, whatever the case', () => {
    expect(labels.tags.map((t) => t.key)).toEqual(['investor', 'speaker']);
    expect(labels.groups.map((g) => g.id)).toEqual([1, 2]);
  });

  it('makes a tag key from its name, unique among the others', () => {
    expect(tagKey('Fintech & AI', new Set())).toBe('fintech-and-ai');
    expect(tagKey('Speaker', new Set(['speaker']))).toBe('speaker-2');
    expect(tagKey('Speaker', new Set(['speaker', 'speaker-2']))).toBe('speaker-3');
    expect(tagKey('ไทย', new Set())).toBe('tag');
  });

  it('names a contact’s tags and groups, leaving deleted ones out', () => {
    expect(tagNames(['speaker', 'gone'], labels)).toEqual(['Speaker']);
    expect(groupNames([2, 9], labels)).toEqual(['Volunteers']);
  });

  it('keeps only the tags and groups that exist from a posted form', () => {
    expect(
      knownLabelsOnly({ tags: ['speaker', 'vip'], groups: [1, 9], name: 'x' }, labels),
    ).toEqual({ tags: ['speaker'], groups: [1], name: 'x' });
  });
});
