// Term pages have no infobox - just prose (see docs/fandom-data.md pilot notes
// for terms). Everything up to the first footer heading is content; tables
// and "See also" link lists don't clean into readable prose, so they're
// dropped by heading name rather than attempted.
const HEADING = /^(={1,})\s*(.+?)\s*\1\s*$/gm;
const FOOTER_HEADINGS = new Set(['Примечания', 'Навигация по сайту']);
const SKIP_HEADINGS = (title: string) => title.startsWith('Таблица') || title === 'См. также';

function cleanHeading(raw: string): string {
  // Section headings are sometimes themselves wikilinks, e.g. "[[Операция на Русиме]]".
  return raw
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
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
  // Wiki-table syntax ({| ... |}) doesn't clean into prose regardless of
  // which heading it's under - drop the whole block.
  v = v.replace(/\{\|[\s\S]*?\n\|\}/g, '');
  v = v.replace(/\[\[File:[^\]]*\]\]/gi, '').replace(/\[\[Файл:[^\]]*\]\]/gi, '');
  // Category tags have no heading before them, so they can end up inside the
  // last real section when a page has no "Примечания"/"Навигация" footer.
  v = v.replace(/\[\[Категория:[^\]]*\]\]/gi, '').replace(/\[\[Category:[^\]]*\]\]/gi, '');
  v = v.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1');
  // External links: [url text] -> text, [url] -> removed.
  v = v.replace(/\[https?:\/\/\S+\s+([^\]]+)\]/gi, '$1').replace(/\[https?:\/\/\S+\]/gi, '');
  v = v.replace(/<br\s*\/?>/gi, '\n');
  v = v.replace(/<[^>]+>/g, '');
  v = v.replace(/''+/g, '');
  v = v.replace(/^\*+\s*/gm, '');
  v = v.replace(/\n{3,}/g, '\n\n').trim();
  return v;
}

export function extractDefinition(wikitext: string): string {
  const headings = [...wikitext.matchAll(HEADING)];
  const footer = headings.find((h) => FOOTER_HEADINGS.has(h[2]));
  const body = footer ? wikitext.slice(0, footer.index!) : wikitext;

  const parts: string[] = [];
  const bodyHeadings = [...body.matchAll(HEADING)];
  const lead = bodyHeadings.length ? body.slice(0, bodyHeadings[0].index!) : body;
  const leadText = stripMarkup(lead);
  if (leadText) parts.push(leadText);

  // Only top-level (==) headings get their own block; ===/==== subsections
  // stay inline inside it (indexOf over all levels is still needed so a
  // level-2 slice correctly stops at the next level-2 heading, not the
  // file's end - nesting one more level in would just duplicate the text).
  for (let i = 0; i < bodyHeadings.length; i++) {
    if (bodyHeadings[i][1].length !== 2) continue;
    const title = cleanHeading(bodyHeadings[i][2]);
    if (SKIP_HEADINGS(title)) continue;
    const start = bodyHeadings[i].index! + bodyHeadings[i][0].length;
    const next = bodyHeadings.find((h, j) => j > i && h[1].length <= 2);
    const end = next ? next.index! : body.length;
    const section = stripMarkup(body.slice(start, end));
    if (section) parts.push(`## ${title}\n${section}`);
  }

  return parts.join('\n\n');
}
