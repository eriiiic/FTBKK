import { describe, expect, it } from 'vitest';
import {
  CONTACT_EMAIL_TOKEN,
  DEFAULT_CODE_OF_CONDUCT,
  fillCodeOfConduct,
} from '../src/lib/code-of-conduct';
import { renderMarkdown } from '../src/lib/markdown';

describe('code of conduct', () => {
  it('fills in the contact email as a mailto link', () => {
    const md = fillCodeOfConduct(DEFAULT_CODE_OF_CONDUCT, 'hello@example.com');
    expect(md).not.toContain(CONTACT_EMAIL_TOKEN);
    expect(renderMarkdown(md)).toContain('href="mailto:hello@example.com"');
  });

  it('replaces every occurrence of the placeholder', () => {
    expect(fillCodeOfConduct('{contactEmail} or {contactEmail}', 'a@b.co')).toBe(
      'a@b.co or a@b.co',
    );
  });

  it('falls back to the default text when emptied', () => {
    expect(fillCodeOfConduct('  \n', 'a@b.co')).toBe(
      fillCodeOfConduct(DEFAULT_CODE_OF_CONDUCT, 'a@b.co'),
    );
  });

  it('keeps an edited text as is', () => {
    expect(fillCodeOfConduct('## Be nice', 'a@b.co')).toBe('## Be nice');
  });

  it('uses the full name and covers events, online groups and the website', () => {
    expect(DEFAULT_CODE_OF_CONDUCT).toContain('La French Tech Bangkok');
    expect(DEFAULT_CODE_OF_CONDUCT).toMatch(/WhatsApp, LinkedIn/);
    expect(DEFAULT_CODE_OF_CONDUCT).toContain('this website');
  });
});
