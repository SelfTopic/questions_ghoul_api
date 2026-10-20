// Pilot-only prose extractor: pulls a few narrative sections out of raw
// wikitext (no HTML render, no new dependency) and lightly cleans them for
// a model to read - see docs/question-generation.md pilot notes.
const HEADING = /^(={2,})\s*(.+?)\s*\1\s*$/gm;
// Different pages spell the same section differently - checked frequencies
// across all 281 characters before picking these synonyms.
const WANTED_SECTIONS = new Set([
  'Личность',
  'Характер',
  'Сюжетная линия',
  'Сюжет',
  'История',
  'Отношения',
  'Интересные факты',
  'Факты',
]);

function cleanHeadingText(raw: string): string {
  return raw
    .replace(/\[\[([^|\]]+)(?:\|[^\]]+)?\]\]/g, '$1')
    .replace(/''+/g, '')
    .trim();
}

function stripMarkup(wikitext: string): string {
  let v = wikitext;
  for (let i = 0; i < 5; i++) {
    const next = v.replace(/\{\{[^{}]*\}\}/g, '');
    if (next === v) break;
    v = next;
  }
  v = v.replace(/<ref[^>]*\/>/gi, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '');
  v = v.replace(/<s>[\s\S]*?<\/s>/gi, ''); // struck-through = no longer true
  v = v.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1');
  v = v.replace(/<br\s*\/?>/gi, '\n');
  v = v.replace(/<[^>]+>/g, '');
  v = v.replace(/''+/g, '');
  v = v.replace(/^\*+\s*/gm, '');
  v = v.replace(/\n{3,}/g, '\n\n').trim();
  return v;
}

/** Joins the narrative sections a model needs to write grounded questions:
 * personality, plot, relationships, trivia. Skips appearance/gallery/nav. */
export function extractProse(wikitext: string): string {
  const headings = [...wikitext.matchAll(HEADING)];
  const parts: string[] = [];

  for (let i = 0; i < headings.length; i++) {
    const title = cleanHeadingText(headings[i][2]);
    if (!WANTED_SECTIONS.has(title)) continue;

    const start = headings[i].index! + headings[i][0].length;
    const next = headings.find((h, j) => j > i && h[1].length <= headings[i][1].length);
    const end = next ? next.index! : wikitext.length;

    const body = stripMarkup(wikitext.slice(start, end));
    if (body) parts.push(`## ${title}\n${body}`);
  }

  return parts.join('\n\n');
}
