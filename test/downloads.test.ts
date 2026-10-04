import { describe, expect, it } from 'vitest';
import { expandDownloads } from '../src/lib/markdown';

const files = [{ name: 'Tech_Pulse_Q3.pdf', key: 'files/abc.pdf', size: 412_000 }];
const url = (k: string) => `/media/${k}`;

describe('expandDownloads', () => {
  it('turns a tag into a link with the file size', () => {
    expect(expandDownloads('See {{download: Tech_Pulse_Q3.pdf}}.', files, url)).toBe(
      'See [Tech_Pulse_Q3.pdf (402 KB)](/media/files/abc.pdf).',
    );
  });
  it('uses the friendly name and ignores case', () => {
    expect(expandDownloads('{{ download: tech_pulse_q3.PDF | Read the report }}', files, url)).toBe(
      '[Read the report (402 KB)](/media/files/abc.pdf)',
    );
  });
  it('drops a tag naming no attachment', () => {
    expect(expandDownloads('A {{download: missing.pdf}} B', files, url)).toBe('A  B');
  });
});
