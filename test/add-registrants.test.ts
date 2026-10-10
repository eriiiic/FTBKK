import { describe, expect, it } from 'vitest';
import {
  REGISTRANT_TEMPLATE,
  RegistrantSchema,
  parseRegistrantsCsv,
} from '../src/lib/add-registrants';
import { parseDelimited } from '../src/lib/csv';

describe('parseRegistrantsCsv', () => {
  it('reads the template', () => {
    const { rows, errors } = parseRegistrantsCsv(REGISTRANT_TEMPLATE);
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      {
        line: 2,
        data: {
          name: 'Marie Dupont',
          email: 'marie@example.com',
          company: 'Acme Co',
          role: 'Founder',
          phone: '081 234 5678',
          guests: 1,
          note: 'Vegetarian',
          attended: false,
        },
      },
      {
        line: 3,
        data: {
          name: 'Somchai Rak',
          email: 'somchai@example.com',
          company: null,
          role: null,
          phone: null,
          guests: 0,
          note: null,
          attended: true,
        },
      },
    ]);
  });

  it('finds columns by header in any order, with aliases and first + last name', () => {
    const csv =
      'E-mail;First Name;Last name;Job title;Checked in;Other\n A@B.co ;Ann;Lee;CTO;yes;x\n';
    const { rows, errors } = parseRegistrantsCsv(csv);
    expect(errors).toEqual([]);
    expect(rows[0]?.data).toMatchObject({
      name: 'Ann Lee',
      email: 'a@b.co',
      role: 'CTO',
      attended: true,
    });
  });

  it('lists bad rows with their line and leaves out repeated emails', () => {
    const csv = [
      'name,email,guests',
      'Ann Lee,ann@example.com,2',
      'X,bad-email,0',
      'Bob Ray,bob@example.com,9',
      'Ann again,ANN@example.com,',
    ].join('\n');
    const { rows, errors } = parseRegistrantsCsv(csv);
    expect(rows.map((r) => r.data.email)).toEqual(['ann@example.com']);
    expect(errors.map((e) => e.line)).toEqual([3, 4, 5]);
    expect(errors[0]?.message).toMatch(/Name is missing/);
    expect(errors[0]?.message).toMatch(/valid email/);
    expect(errors[1]?.message).toMatch(/Guests must be a number from 0 to 5/);
    expect(errors[2]?.message).toMatch(/line 2/);
  });

  it('needs a header with name and email', () => {
    expect(parseRegistrantsCsv('Ann Lee,ann@example.com\n').errors[0]?.message).toMatch(
      /at least "name" and "email"/,
    );
    expect(parseRegistrantsCsv('').errors[0]?.message).toMatch(/empty/);
  });

  it("drops the quote our own exports put before a phone number's +", () => {
    const { rows } = parseRegistrantsCsv("name,email,phone\nAnn Lee,ann@example.com,'+66 81 234\n");
    expect(rows[0]?.data.phone).toBe('+66 81 234');
  });
});

describe('RegistrantSchema', () => {
  it('requires a name and an email', () => {
    const r = RegistrantSchema.safeParse({ name: ' ', email: '' });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.message)).toEqual([
      'Name is missing or too short.',
      'Email is missing.',
    ]);
  });
});

describe('parseDelimited', () => {
  it('picks semicolons when the header has no comma', () => {
    expect(parseDelimited('a;b\n1;"x;y"\n')).toEqual([
      ['a', 'b'],
      ['1', 'x;y'],
    ]);
  });
});
