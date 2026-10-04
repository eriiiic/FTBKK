import { describe, expect, it } from 'vitest';
import { inflateSync } from 'node:zlib';
import jsQR from 'jsqr';
import { normalizeCode, qrPng, ticketCode } from '../src/lib/ticket';

describe('ticketCode', () => {
  it('is a stable 8-character code, different per token', async () => {
    const a = await ticketCode('token-a');
    expect(a).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(await ticketCode('token-a')).toBe(a);
    expect(await ticketCode('token-b')).not.toBe(a);
  });
  it('normalizes typed codes', () => {
    expect(normalizeCode('k7q2 m9xa')).toBe('K7Q2M9XA');
    expect(normalizeCode('O1-IL')).toBe('0111');
  });
});

describe('qrPng', () => {
  it('draws a PNG that a QR reader decodes back to the text', async () => {
    const png = await qrPng('K7Q2-M9XA', 4);
    expect([...png.slice(1, 4)].map((c) => String.fromCharCode(c)).join('')).toBe('PNG');
    const view = new DataView(png.buffer);
    const side = view.getUint32(16);
    // IDAT starts after the 8-byte signature and the 25-byte IHDR chunk.
    const len = view.getUint32(33);
    const raw = inflateSync(png.subarray(41, 41 + len));
    const rgba = new Uint8ClampedArray(side * side * 4);
    for (let y = 0; y < side; y++)
      for (let x = 0; x < side; x++) {
        const g = raw[y * (side + 1) + 1 + x]!;
        rgba.set([g, g, g, 255], (y * side + x) * 4);
      }
    expect(jsQR(rgba, side, side)?.data).toBe('K7Q2-M9XA');
  });
});
