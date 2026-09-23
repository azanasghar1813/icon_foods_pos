/** True when the event is aimed at a field where the user is writing. */
export function isTypingInField(e: KeyboardEvent | { target?: EventTarget | null }): boolean {
  const nodes: Array<EventTarget | null | undefined> = [e.target]
  if (typeof document !== 'undefined') nodes.push(document.activeElement)
  for (const node of nodes) {
    if (!(node instanceof HTMLElement)) continue
    const el = node
    if (el.isContentEditable) return true
    const tag = el.tagName
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true
    if (tag === 'INPUT') {
      const type = ((el as HTMLInputElement).type || 'text').toLowerCase()
      if (['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'hidden', 'color', 'range', 'image'].includes(type)) {
        continue
      }
      return true
    }
    if (el.closest('[contenteditable="true"]')) return true
  }
  return false
}

/** Browser edit chords that must never be stolen while typing. */
export function isNativeEditKey(e: KeyboardEvent): boolean {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return false
  const k = e.key.toLowerCase()
  return ['c', 'v', 'x', 'a', 'z', 'y'].includes(k)
}

export function isFunctionKey(e: KeyboardEvent): boolean {
  return /^F\d{1,2}$/.test(e.key)
}

/**
 * While a text field is focused, ignore app shortcuts except:
 * Escape, F1–F12, and Ctrl+Enter (fast pay / confirm).
 */
export function shouldIgnoreShortcutWhileTyping(e: KeyboardEvent): boolean {
  if (!isTypingInField(e)) return false
  if (isNativeEditKey(e)) return true
  if (e.key === 'Escape' || isFunctionKey(e)) return false
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') return false
  return true
}
