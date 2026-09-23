/**
 * Ticket numbers: new tickets are "#1". Old till tickets stay "A - #1".
 * Stored unique form for new tickets is YYYYMMDD-#n so daily reset can reuse #1.
 */

export const SHARED_TICKET_PREFIX = 'SHARED';

export function parseTicketSeq(raw) {
  const cleaned = String(raw || '').trim();
  if (!cleaned) return 0;
  let m = cleaned.match(/^\d{8}-#(\d+)$/);
  if (m) return Number(m[1]);
  m = cleaned.match(/^([A-F])[-\s]*\d{8}[-\s]*#?\s*0*(\d+)$/i);
  if (m) return Number(m[2]);
  m = cleaned.match(/^([A-F])\s*-\s*#\s*0*(\d+)$/i);
  if (m) return Number(m[2]);
  m = cleaned.match(/^(?:PC-?)?([A-F])[-\s]*#?\s*0*(\d+)$/i);
  if (m) return Number(m[2]);
  m = cleaned.match(/^#\s*0*(\d+)$/);
  if (m) return Number(m[1]);
  m = cleaned.match(/(\d+)\s*$/);
  return m ? Number(m[1]) : 0;
}

export function buildReceiptOrderNumber(_prefix, seq, businessDate) {
  const n = Number(seq) || 1;
  const ymd = String(businessDate || '').replace(/-/g, '');
  if (/^\d{8}$/.test(ymd)) return `${ymd}-#${n}`;
  return `#${n}`;
}

export function formatReceiptOrderNumber(raw) {
  const cleaned = String(raw || '').trim().replace(/^#+/, '');
  if (!cleaned) return 'N/A';
  let m = cleaned.match(/^(\d{8})-#0*(\d+)$/);
  if (m) return `#${Number(m[2])}`;
  m = cleaned.match(/^#\s*0*(\d+)$/);
  if (m) return `#${Number(m[1])}`;
  m = cleaned.match(/^([A-F])[-\s]*(\d{8})[-\s]*#?\s*0*(\d+)$/i);
  if (m) return `${m[1].toUpperCase()} - #${Number(m[3])}`;
  m = cleaned.match(/^([A-F])\s*-\s*#\s*0*(\d+)$/i);
  if (m) return `${m[1].toUpperCase()} - #${Number(m[2])}`;
  m = cleaned.match(/^(?:PC-?)?([A-F])[-\s]*#?\s*0*(\d+)$/i);
  if (m) return `${m[1].toUpperCase()} - #${Number(m[2])}`;
  if (/^\d+$/.test(cleaned)) return `#${Number(cleaned)}`;
  return cleaned;
}

export const TILL_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function tillLetterFromPrefix(prefix) {
  const p = String(prefix || '').trim().toUpperCase();
  const pc = p.match(/^PC-([A-F])$/);
  if (pc) return pc[1];
  const pc2 = p.match(/^PC([A-F])$/);
  if (pc2) return pc2[1];
  if (/^[A-F]$/.test(p)) return p;
  return '';
}

export function canonicalTillPrefix(raw) {
  const letter = tillLetterFromPrefix(raw);
  return TILL_LETTERS.includes(letter) ? `PC-${letter}` : null;
}

export function isAssignedTillPrefix(raw) {
  return !!canonicalTillPrefix(raw);
}
