// Event tickets: a short check-in code per registration and its QR code as a PNG for emails.
import { encode } from 'uqr';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32: no I, L, O, U

/**
 * The code on a registration's ticket, e.g. "K7Q2-M9XA". Derived from the registration token, so
 * nothing new is stored, and the token itself (which can cancel the seat) never leaves the email.
 */
export async function ticketCode(token: string) {
  const hash = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`ticket:${token}`)),
  );
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of hash) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5 && out.length < 8) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    if (out.length === 8) break;
  }
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

/** What people type or scan at the door, reduced to the bare code ("k7q2 m9xa" -> "K7Q2M9XA"). */
export const normalizeCode = (s: string) =>
  s
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');

// ---------- PNG ----------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

async function deflate(data: Uint8Array) {
  const stream = new Blob([data as Uint8Array<ArrayBuffer>])
    .stream()
    .pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** A black-on-white QR code PNG (8-bit grayscale), `scale` pixels per module, quiet zone included. */
export async function qrPng(text: string, scale = 8, margin = 4) {
  const qr = encode(text, { ecc: 'M' });
  const modules = qr.size + margin * 2;
  const side = modules * scale;
  const raw = new Uint8Array(side * (side + 1)).fill(255);
  for (let y = 0; y < side; y++) {
    const row = y * (side + 1);
    raw[row] = 0; // filter: none
    const my = Math.floor(y / scale) - margin;
    for (let x = 0; x < side; x++) {
      const mx = Math.floor(x / scale) - margin;
      if (qr.data[my]?.[mx]) raw[row + 1 + x] = 0;
    }
  }
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, side);
  v.setUint32(4, side);
  ihdr.set([8, 0, 0, 0, 0], 8); // 8-bit, grayscale, deflate, no filter, no interlace
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', await deflate(raw)),
    chunk('IEND', new Uint8Array()),
  ];
  const png = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    png.set(p, at);
    at += p.length;
  }
  return png;
}
