// See docs/question-generation.md "Решено: очистка значений" for the rules.
const STOP_VALUES = new Set(['неизвестно', 'опционально', 'н/д', 'нет данных', '—', '-']);

/** Cleans one infobox field value for use as a quiz answer/distractor, or
 * returns null if it shouldn't be used at all (struck-through = no longer
 * true, compound, junk, or leftover markup we don't understand). */
export function cleanFieldValue(raw: string): string | null {
  let v = raw.replace(/<s>[\s\S]*?<\/s>/gi, '');
  v = v.replace(/\{\{[^{}]*\}\}/g, '');
  v = v.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1');
  v = v.replace(/<[^>]+>/g, '');
  v = v.replace(/''+/g, '');
  v = v.trim();

  if (!v) return null;
  if (STOP_VALUES.has(v.toLowerCase())) return null;
  if (/\n/.test(v)) return null; // compound (multi-line) value
  if (/\s•\s/.test(v)) return null; // compound (bullet-separated) value
  if (/[{}<>]/.test(v)) return null; // unresolved markup left over - don't show garbage
  return v;
}
