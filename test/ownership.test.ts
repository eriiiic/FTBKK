import { describe, expect, it } from 'vitest';
import { EVENT_STEPS, defaultOwners, dueDate, taskState, teamName } from '../src/lib/ownership';

const start = new Date('2026-11-12T11:00:00Z'); // 18:00 in Bangkok

describe('event checklist', () => {
  it('has unique step keys, in date order', () => {
    const keys = EVENT_STEPS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    const offsets = EVENT_STEPS.map((s) => s.offset);
    expect([...offsets].sort((a, b) => a - b)).toEqual(offsets);
  });

  it('dates each step from the event start', () => {
    expect(dueDate(start, -21).toISOString()).toBe('2026-10-22T11:00:00.000Z');
    expect(dueDate(start, 7).toISOString()).toBe('2026-11-19T11:00:00.000Z');
  });

  it('is late only once the Bangkok due day has passed', () => {
    const due = dueDate(start, 0);
    expect(taskState(due, null, new Date('2026-11-12T16:00:00Z'))).toBe('soon'); // 23:00 same day
    expect(taskState(due, null, new Date('2026-11-12T17:00:00Z'))).toBe('late'); // next day 00:00
    expect(taskState(due, new Date(), new Date('2026-12-01T00:00:00Z'))).toBe('done');
    expect(taskState(due, null, new Date('2026-10-01T00:00:00Z'))).toBe('later');
  });
});

describe('team', () => {
  const team = [
    { name: 'Alice', email: 'alice@example.com', roles: ['lead', 'comms'] },
    { name: 'Bob', email: 'bob@example.com', roles: ['comms', 'door'] },
  ];
  it('gives each role to the first member who has it', () => {
    const owners = defaultOwners(team);
    expect(owners.get('lead')).toBe('alice@example.com');
    expect(owners.get('comms')).toBe('alice@example.com');
    expect(owners.get('door')).toBe('bob@example.com');
    expect(owners.has('board')).toBe(false);
  });
  it('names owners, falling back to the email', () => {
    expect(teamName(team, 'bob@example.com')).toBe('Bob');
    expect(teamName(team, 'gone@example.com')).toBe('gone@example.com');
    expect(teamName(team, null)).toBe('');
  });
});
