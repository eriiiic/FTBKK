import { describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/d1';
import { events } from '../src/db/schema';
import { registrationCount } from '../src/lib/registrations';

describe('registrationCount', () => {
  it('counts against the outer event, not the registration id', () => {
    const q = drizzle({} as never)
      .select({ id: events.id, n: registrationCount(['registered', 'attended']) })
      .from(events)
      .toSQL();
    expect(q.sql).toContain('r.event_id = "events"."id"');
    expect(q.params).toEqual(['registered', 'attended']);
  });
});
