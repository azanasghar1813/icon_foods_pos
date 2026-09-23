/** Display new tickets as "#1". Old till tickets stay "A - #1". */

export const TILL_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const

export function tillLetterFromPrefix(prefix?: string | null): string {
  const p = String(prefix || '').trim().toUpperCase()
  const pc = p.match(/^PC-([A-F])$/)
  if (pc) return pc[1]
  const pc2 = p.match(/^PC([A-F])$/)
  if (pc2) return pc2[1]
  if (/^[A-F]$/.test(p)) return p
  return ''
}

export function isAssignedTillPrefix(raw?: string | null): boolean {
  return TILL_LETTERS.includes(tillLetterFromPrefix(raw) as (typeof TILL_LETTERS)[number])
}

export function formatReceiptOrderNumber(raw?: string | number | null): string {
  const cleaned = String(raw ?? '').trim().replace(/^#+/, '')
  if (!cleaned) return 'N/A'
  let m = cleaned.match(/^(\d{8})-#0*(\d+)$/)
  if (m) return `#${Number(m[2])}`
  m = cleaned.match(/^#\s*0*(\d+)$/)
  if (m) return `#${Number(m[1])}`
  m = cleaned.match(/^([A-F])[-\s]*(\d{8})[-\s]*#?\s*0*(\d+)$/i)
  if (m) return `${m[1].toUpperCase()} - #${Number(m[3])}`
  m = cleaned.match(/^([A-F])\s*-\s*#\s*0*(\d+)$/i)
  if (m) return `${m[1].toUpperCase()} - #${Number(m[2])}`
  m = cleaned.match(/^(?:PC-?)?([A-F])[-\s]*#?\s*0*(\d+)$/i)
  if (m) return `${m[1].toUpperCase()} - #${Number(m[2])}`
  if (/^\d+$/.test(cleaned)) return `#${Number(cleaned)}`
  return cleaned
}
