import { describe, expect, it } from 'vitest';
import { MAX_SPEAKERS, SpeakersFormSchema, personLine, planSpeakers } from '../src/lib/speakers';

const prev = [
  { personId: 1, talkTitle: 'Scaling in SEA' },
  { personId: 2, talkTitle: null },
];
const all = new Set([1, 2, 3, 4]);
const exists = (id: number) => all.has(id);
const form = (over: Record<string, unknown> = {}) =>
  SpeakersFormSchema.parse({
    speakerId: ['1', '2'],
    speakerTalk: ['Scaling in SEA', ''],
    ...over,
  });

describe('SpeakersFormSchema', () => {
  it('accepts an empty add section', () => {
    const d = form({ addPersonId: '', newName: '', newLinkedin: '' });
    expect(d.addPersonId).toBeNull();
    expect(d.newName).toBeNull();
    expect(d.newLinkedin).toBeNull();
  });
  it('normalises the LinkedIn link of a new speaker', () => {
    expect(form({ newName: 'Ana', newLinkedin: 'linkedin.com/in/ana' }).newLinkedin).toBe(
      'https://linkedin.com/in/ana',
    );
  });
  it('refuses both an existing person and a new one', () => {
    const r = SpeakersFormSchema.safeParse({ addPersonId: '3', newName: 'Ana Lee' });
    expect(r.success).toBe(false);
  });
  it('refuses a one-letter name', () => {
    expect(SpeakersFormSchema.safeParse({ newName: 'A' }).success).toBe(false);
  });
});

describe('planSpeakers', () => {
  it('keeps the form order and edited talk titles', () => {
    const plan = planSpeakers(
      prev,
      form({ speakerId: ['2', '1'], speakerTalk: [' Fundraising ', ''] }),
      exists,
    );
    expect(plan).toEqual([
      { personId: 2, talkTitle: 'Fundraising', sortOrder: 0 },
      { personId: 1, talkTitle: null, sortOrder: 1 },
    ]);
  });
  it('removes ticked speakers', () => {
    const plan = planSpeakers(prev, form({ speakerRemove: ['1'] }), exists);
    expect(plan.map((s) => s.personId)).toEqual([2]);
  });
  it('appends the added person with its talk title', () => {
    const plan = planSpeakers(
      prev,
      form({ addPersonId: '3', addTalkTitle: 'AI in retail' }),
      exists,
    );
    expect(plan.at(-1)).toEqual({ personId: 3, talkTitle: 'AI in retail', sortOrder: 2 });
  });
  it('uses the id of a newly created person', () => {
    const plan = planSpeakers(prev, form(), exists, 4);
    expect(plan.map((s) => s.personId)).toEqual([1, 2, 4]);
  });
  it('does not link someone twice, but updates the talk title', () => {
    const plan = planSpeakers(prev, form({ addPersonId: '2', addTalkTitle: 'Keynote' }), exists);
    expect(plan).toHaveLength(2);
    expect(plan[1]).toMatchObject({ personId: 2, talkTitle: 'Keynote' });
  });
  it('ignores ids that are not current speakers or do not exist', () => {
    const plan = planSpeakers(prev, form({ speakerId: ['1', '2', '3', '99'] }), exists);
    expect(plan.map((s) => s.personId)).toEqual([1, 2]);
    expect(planSpeakers(prev, form({ addPersonId: '99' }), exists)).toHaveLength(2);
  });
  it('keeps speakers missing from the form', () => {
    const plan = planSpeakers(prev, form({ speakerId: ['2'], speakerTalk: [''] }), exists);
    expect(plan.map((s) => s.personId)).toEqual([2, 1]);
    expect(plan[1]!.talkTitle).toBe('Scaling in SEA');
  });
  it('drops a speaker whose person was deleted', () => {
    const plan = planSpeakers(prev, form(), (id) => id === 2);
    expect(plan).toEqual([{ personId: 2, talkTitle: null, sortOrder: 0 }]);
  });
  it('caps the list', () => {
    const many = Array.from({ length: MAX_SPEAKERS }, (_, i) => ({
      personId: i + 1,
      talkTitle: null,
    }));
    const plan = planSpeakers(many, SpeakersFormSchema.parse({}), () => true, 500);
    expect(plan).toHaveLength(MAX_SPEAKERS);
  });
});

describe('personLine', () => {
  it('joins title and company', () => {
    expect(personLine({ title: 'CTO', organisationName: 'Acme' })).toBe('CTO, Acme');
    expect(personLine({ title: null, organisationName: 'Acme' })).toBe('Acme');
    expect(personLine({ title: null, organisationName: null })).toBe('');
  });
});
