import { describe, expect, it } from 'vitest';
import {
  bangkokTimestamp,
  decodeGuestFile,
  linkedinUrl,
  parseWixGuests,
  tidyName,
} from '../scripts/lib/wix-guests';

const HEADER = [
  'Order number',
  'Order date',
  'Guest first name',
  'Guest last name',
  'Email',
  'Ticket number',
  'Ticket price',
  'Checked in',
  'What is your current company?',
  'Job title',
  'What is your LinkedIn profile URL',
  'Anything we should know?',
];
const row = (...v: string[]) => v.join('\t');

describe('parseWixGuests', () => {
  const text = [
    HEADER.join('\t'),
    row(
      'A1',
      '2026-06-28 18:22:39',
      'octave',
      'despointes',
      'O.Despointes@gmail.com',
      'A11P',
      'Free',
      'No',
      'Guidestination',
      'Ceo',
      'Octave D',
      '',
    ),
    row(
      'A1',
      '2026-06-28 18:22:39',
      'octave',
      'despointes',
      'o.despointes@gmail.com',
      'A11Q',
      'Free',
      'No',
      'Guidestination',
      'Ceo',
      'Octave D',
      '',
    ),
    row(
      'B2',
      '2026-07-21 01:05:12',
      'Rayen',
      'Dahmani',
      'r@x.com',
      'B21P',
      'Free',
      'No',
      '',
      '',
      '',
      '',
    ),
    row(
      'B3',
      '2026-07-21 01:06:03',
      'Rayen',
      'Dahmani',
      'r@x.com',
      'B31P',
      'Free',
      'Yes',
      'Acme',
      '',
      'www.linkedin.com/in/rayen?utm_source=share',
      '"Hi\tthere"',
    ),
  ].join('\r\n');

  it('keeps one guest per email, merging duplicate tickets and repeat orders', () => {
    const guests = parseWixGuests(text);
    expect(guests.map((g) => g.email)).toEqual(['o.despointes@gmail.com', 'r@x.com']);
    expect(guests[0]).toMatchObject({
      name: 'Octave Despointes',
      company: 'Guidestination',
      role: 'Ceo',
      linkedin: null,
      notes: null,
      checkedIn: false,
      orderedAt: bangkokTimestamp('2026-06-28 18:22:39'),
    });
    expect(guests[1]).toMatchObject({
      company: 'Acme',
      linkedin: 'https://www.linkedin.com/in/rayen',
      notes: 'Hi there',
      checkedIn: true,
      orderedAt: bangkokTimestamp('2026-07-21 01:05:12'),
    });
  });

  it('reads the UTF-16 file Wix exports', () => {
    const utf16 = new Uint8Array([0xff, 0xfe, ...Buffer.from(text, 'utf16le')]);
    expect(parseWixGuests(decodeGuestFile(utf16))).toHaveLength(2);
  });
});

describe('helpers', () => {
  it('reads Wix order dates as Bangkok time', () => {
    expect(bangkokTimestamp('2026-10-01 07:35:34')).toBe(Date.parse('2026-10-01T00:35:34Z') / 1000);
    expect(bangkokTimestamp('soon')).toBeNull();
  });
  it('keeps only LinkedIn URLs', () => {
    expect(linkedinUrl('Octave Huyghues Despointes')).toBeNull();
    expect(linkedinUrl('https://th.linkedin.com/in/x/?locale=fr')).toBe(
      'https://th.linkedin.com/in/x/',
    );
  });
  it('capitalises names typed in lower case only', () => {
    expect(tidyName("jean-marc o'neil")).toBe("Jean-Marc O'Neil");
    expect(tidyName('Tony FOUACHE')).toBe('Tony FOUACHE');
  });
});
