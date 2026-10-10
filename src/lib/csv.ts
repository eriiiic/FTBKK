/** One CSV cell: quoted when needed, and never read as a formula when opened in Excel. */
export const csvCell = (v: unknown) => {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Decodes an uploaded CSV whatever its encoding (Wix exports UTF-16 LE with a BOM; Excel may add a UTF-8 BOM). */
export function decodeGuestFile(buf: Uint8Array): string {
  if (buf[0] === 0xff && buf[1] === 0xfe)
    return new TextDecoder('utf-16le').decode(buf.subarray(2));
  if (buf[0] === 0xfe && buf[1] === 0xff)
    return new TextDecoder('utf-16be').decode(buf.subarray(2));
  return new TextDecoder('utf-8').decode(buf).replace(/^﻿/, '');
}

/**
 * Splits CSV/TSV text, honouring double quotes (fields may contain line breaks). The separator is a
 * tab when the first line has one, else a semicolon when it has one and no comma (Excel in some
 * locales), else a comma.
 */
export function parseDelimited(text: string): string[][] {
  const firstLine = text.slice(0, text.indexOf('\n') >>> 0);
  const sep = firstLine.includes('\t')
    ? '\t'
    : firstLine.includes(';') && !firstLine.includes(',')
      ? ';'
      : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const endRow = () => {
    row.push(field);
    if (row.some((f) => f.trim())) rows.push(row);
    row = [];
    field = '';
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === sep) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      endRow();
    } else field += c;
  }
  endRow();
  return rows;
}
