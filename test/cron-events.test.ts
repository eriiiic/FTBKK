import { describe, expect, it } from 'vitest';
import { bangkokDay } from '../src/lib/cron-events';

describe('bangkokDay', () => {
  it('uses the Bangkok calendar date', () => {
    expect(bangkokDay(new Date('2026-11-01T16:59:00Z'))).toBe('2026-11-01');
    expect(bangkokDay(new Date('2026-11-01T17:00:00Z'))).toBe('2026-11-02');
  });
});
