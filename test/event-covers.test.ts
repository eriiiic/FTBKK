import { describe, expect, it } from 'vitest';
import { eventCover, eventKind, seriesFor } from '../src/lib/event-covers';

describe('event covers', () => {
  it('reads the type from the series', () => {
    expect(eventKind('French Tech Connect')).toBe('connect');
    expect(eventKind('French Tech Talk')).toBe('talk');
    expect(eventKind('AI Agent')).toBe('other');
    expect(seriesFor('talk', 'ignored')).toBe('French Tech Talk');
    expect(seriesFor('other', ' Workshop ')).toBe('Workshop');
    expect(seriesFor('other', '')).toBe('Other');
  });

  it('uses the event cover, then the Settings default, then the built-in one', () => {
    const covers = { connect: 'defaults/connect.jpg', talk: null };
    expect(eventCover({ coverKey: 'c/1.jpg', series: 'French Tech Talk' }, covers)).toBe(
      '/media/c/1.jpg',
    );
    expect(eventCover({ coverKey: null, series: 'French Tech Connect' }, covers)).toBe(
      '/media/defaults/connect.jpg',
    );
    expect(eventCover({ coverKey: null, series: 'French Tech Talk' }, covers)).toBe(
      '/brand/events/talk.jpg',
    );
    expect(eventCover({ coverKey: null, series: 'Workshop' }, covers)).toBeNull();
  });
});
