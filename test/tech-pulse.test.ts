import { describe, expect, it } from 'vitest';
import { editionOf, isTechPulse, reportFile } from '../src/lib/tech-pulse';
import { DEFAULT_THAI_PAGE, thaiSections } from '../src/lib/thai-page';

describe('Tech Pulse editions', () => {
  it('recognises editions and reads the quarter from the title', () => {
    expect(isTechPulse('Thailand Tech Pulse Q3 2026: A New Phase')).toBe(true);
    expect(isTechPulse('French Tech 2026: An Ecosystem Ready')).toBe(false);
    expect(editionOf('Thailand Tech Pulse Q1 2026 — First Edition Is Out')).toBe('Q1 2026');
    expect(editionOf('Tech Pulse q2, 2027')).toBe('Q2 2027');
    expect(editionOf('Thailand Tech Pulse special edition')).toBeNull();
  });

  it('finds the report PDF in the attachments, else in the text', () => {
    const attachments = [
      { name: 'cover.png', key: 'files/cover.png' },
      { name: 'Thailand_Tech_Pulse_Q3_2026.pdf', key: 'files/tp q3.pdf' },
    ];
    expect(reportFile({ attachments, bodyMd: '' })).toBe('/media/files/tp%20q3.pdf');
    expect(
      reportFile({ attachments: [], bodyMd: 'Get it [here (2 MB)](/media/files/tp-q2.pdf).' }),
    ).toBe('/media/files/tp-q2.pdf');
    expect(reportFile({ attachments: [], bodyMd: 'No file yet.' })).toBeNull();
  });
});

describe('Thai page', () => {
  it('splits the text into an introduction and sections', () => {
    const { intro, sections } = thaiSections('สวัสดี\n\n## หนึ่ง\nข้อความ\n\n## สอง\r\n- ก\n');
    expect(intro).toBe('สวัสดี');
    expect(sections).toEqual([
      { title: 'หนึ่ง', body: 'ข้อความ' },
      { title: 'สอง', body: '- ก' },
    ]);
  });

  it('has an introduction and the Mission French Tech section by default', () => {
    const { intro, sections } = thaiSections(DEFAULT_THAI_PAGE);
    expect(intro).toContain('La French Tech Bangkok');
    expect(sections.map((s) => s.title)).toContain('Mission French Tech');
  });
});
