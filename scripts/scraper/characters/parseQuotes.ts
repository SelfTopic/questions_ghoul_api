import type { ScrapedQuote } from './types';

const SECTION_HEADING = /^(={2,})\s*(.+?)\s*\1\s*$/gm;

function cleanHeading(raw: string): string {
  // Headings are often wikilinks ([[Tokyo Ghoul]], [[Tokyo Ghoul:re|re]]) or italics.
  return raw
    .replace(/\[\[([^|\]]+)(?:\|[^\]]+)?\]\]/g, '$1')
    .replace(/''+/g, '')
    .trim();
}

/** Slices out the "== Цитаты ==" section (up to the next level-2+ heading). */
function extractQuotesSection(wikitext: string): string | null {
  const headings = [...wikitext.matchAll(SECTION_HEADING)];
  const start = headings.find((h) => cleanHeading(h[2]).toLowerCase() === 'цитаты');
  if (!start) return null;

  const startIndex = start.index! + start[0].length;
  const next = headings.find((h) => h.index! > start.index! && h[1].length <= start[1].length);
  const endIndex = next ? next.index! : wikitext.length;
  return wikitext.slice(startIndex, endIndex);
}

// "'''''Обращаясь к Тоуке''''': ''«текст»''" - but some pages put the colon
// *inside* the bold-italic markers ("'''''Обращаясь к Канеки:'''''"), so it's
// optional both inside the captured context and right after it; the '' around
// the quote itself is also optional (some bullets skip it).
const QUOTE_LINE = /^\*\s*(?:'''''(?<context>[^']+?)'''''\s*:?\s*)?'{0,2}«(?<text>[^»]+)»/;

export function parseQuotes(wikitext: string): ScrapedQuote[] {
  const section = extractQuotesSection(wikitext);
  if (!section) return [];

  const workHeadings = [...section.matchAll(/^===\s*(.+?)\s*===\s*$/gm)];
  if (workHeadings.length === 0) {
    // No per-work split - treat the whole section as one unnamed group.
    return extractBullets(section, '');
  }

  const quotes: ScrapedQuote[] = [];
  for (let i = 0; i < workHeadings.length; i++) {
    const work = cleanHeading(workHeadings[i][1]);
    const start = workHeadings[i].index! + workHeadings[i][0].length;
    const end = i + 1 < workHeadings.length ? workHeadings[i + 1].index! : section.length;
    quotes.push(...extractBullets(section.slice(start, end), work));
  }
  return quotes;
}

function extractBullets(text: string, work: string): ScrapedQuote[] {
  const quotes: ScrapedQuote[] = [];
  for (const line of text.split('\n')) {
    const m = line.match(QUOTE_LINE);
    if (!m?.groups) continue;
    const context = m.groups.context?.replace(/:\s*$/, '').trim();
    quotes.push({ work, context: context || null, text: m.groups.text.trim() });
  }
  return quotes;
}
