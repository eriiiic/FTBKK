import { describe, expect, it } from 'vitest';
import { adminNotifyEmails } from '../src/lib/orgs';
import { defaultSettings } from '../src/lib/settings';

describe('adminNotifyEmails', () => {
  it('uses the Admin notifications addresses when set', async () => {
    const s = { ...defaultSettings, moderatorEmails: ['eric@example.com', 'board@example.com'] };
    expect(await adminNotifyEmails(s)).toEqual(['eric@example.com', 'board@example.com']);
  });

  it('falls back to the contact email', async () => {
    const s = { ...defaultSettings, contactEmail: 'hello@example.com', moderatorEmails: [] };
    expect(await adminNotifyEmails(s)).toEqual(['hello@example.com']);
  });
});
