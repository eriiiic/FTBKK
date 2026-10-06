import { describe, expect, it } from 'vitest';
import { MessageAction, canBlockDomain, domainOf, replyLink } from '../src/lib/messages';

describe('messages', () => {
  it('only offers domain blocking for non-webmail domains', () => {
    expect(domainOf(' Spam@Bad-Corp.io ')).toBe('bad-corp.io');
    expect(canBlockDomain('x@bad-corp.io')).toBe(true);
    expect(canBlockDomain('x@gmail.com')).toBe(false);
    expect(canBlockDomain('nope')).toBe(false);
  });

  it('validates block patterns', () => {
    expect(MessageAction.safeParse({ action: 'block', pattern: '@Bad.io' }).data).toEqual({
      action: 'block',
      pattern: '@bad.io',
    });
    expect(MessageAction.safeParse({ action: 'block', pattern: 'a@b.co' }).success).toBe(true);
    expect(MessageAction.safeParse({ action: 'block', pattern: '@gmail.com' }).success).toBe(false);
    expect(MessageAction.safeParse({ action: 'block', pattern: 'hello' }).success).toBe(false);
  });

  it('needs ids to move messages and blocks the address by default on spam', () => {
    expect(MessageAction.safeParse({ action: 'deleted', ids: [] }).success).toBe(false);
    expect(MessageAction.safeParse({ action: 'spam', ids: ['3'] }).data).toEqual({
      action: 'spam',
      ids: [3],
      block: 'address',
    });
  });

  it('accepts a note on one message, optionally filing it', () => {
    expect(
      MessageAction.safeParse({
        action: 'note',
        ids: ['4'],
        body: ' Sent the deck ',
        move: 'answered',
      }).data,
    ).toEqual({ action: 'note', ids: [4], body: 'Sent the deck', move: 'answered' });
    expect(MessageAction.safeParse({ action: 'note', ids: [4], body: '  ' }).success).toBe(false);
    expect(MessageAction.safeParse({ action: 'note', ids: [4, 5], body: 'x' }).success).toBe(false);
  });

  it('builds a reply link with the message quoted', () => {
    const link = replyLink({
      payload: { name: 'Marie Curie', email: 'marie@ex.fr', topic: 'press', message: 'Hi\nthere' },
      createdAt: new Date('2026-10-01T03:00:00Z'),
    });
    expect(link.startsWith('mailto:marie%40ex.fr?subject=')).toBe(true);
    const body = decodeURIComponent(link.split('body=')[1]!);
    expect(body).toContain('Hello Marie,');
    expect(body).toContain('> Hi\n> there');
    expect(decodeURIComponent(link)).toContain('(Press)');
  });
});
