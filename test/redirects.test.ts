import { describe, expect, it } from 'vitest';
import { redirectFor } from '../src/lib/redirects';

describe('Wix redirects', () => {
  it.each([
    ['/post/how-to-start', '/blog/how-to-start'],
    ['/event-details-registration/ftc-52', '/events/ftc-52'],
    ['/event-details-registration/ftc-52/form', '/events/ftc-52'],
    ['/sponsors/accor', '/ecosystem/accor'],
    ['/sponsors', '/ecosystem'],
    ['/services-9', '/ecosystem'],
    ['/team/antoo', '/ecosystem'],
    ['/members', '/ecosystem'],
    ['/fund', '/about'],
    ['/blog/categories/founder-guides', '/blog/category/founder-guides'],
  ])('%s -> %s', (from, to) => expect(redirectFor(from)).toBe(to));

  it('leaves new URLs alone', () => {
    for (const p of ['/', '/blog', '/blog/x', '/events', '/ecosystem/accor', '/about']) {
      expect(redirectFor(p)).toBeNull();
    }
  });
});
