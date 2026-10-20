const FILE_REF = /\[\[(?:File|Файл):([^|\]]+)/gi;

/** Every [[File:...]]/[[Файл:...]] reference in an infobox's values, deduped. */
export function extractFileNames(infobox: Record<string, string>): string[] {
  const names = new Set<string>();
  for (const value of Object.values(infobox)) {
    for (const m of value.matchAll(FILE_REF)) {
      names.add(m[1].trim());
    }
  }
  return [...names];
}
