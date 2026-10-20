// Extracts the {{Character ... }} infobox into a flat field -> raw value map.
// Field values are wikitext (templates/links unresolved), with just <ref>
// citations and <br/> cleaned up - see types.ts for why.

// Some pages write {{Character, others spell out the namespace - in English
// ({{Template:Character) or in its Russian alias ({{Шаблон:Character).
const TEMPLATE_START = /\{\{\s*(?:Template:|Шаблон:)?\s*Character\s*[|\n]/i;

/** Finds the {{Character ... }} block and returns its inner text (without the
 * opening "Character" tag or the final closing braces), or null if absent. */
function extractTemplateBody(wikitext: string): string | null {
  const start = wikitext.search(TEMPLATE_START);
  if (start === -1) return null;

  // Skip past "{{Character" to the first field separator.
  const bodyStart = wikitext.indexOf('|', start);
  if (bodyStart === -1) return null;

  let depth = 1; // we're already inside the opening {{
  let i = start + 2;
  for (; i < wikitext.length && depth > 0; i++) {
    if (wikitext.startsWith('{{', i)) {
      depth++;
      i++;
    } else if (wikitext.startsWith('}}', i)) {
      depth--;
      i++;
    }
  }
  if (depth !== 0) return null; // unbalanced - malformed page, give up

  const templateEnd = i - 2; // position of the matching "}}"
  return wikitext.slice(bodyStart, templateEnd);
}

/** Splits infobox body into top-level "|key = value" chunks, respecting
 * nesting so a value's own {{templates}}, [[links|with pipes]] and
 * <tabber>a=x|-|b=y</tabber> blocks aren't mistaken for field separators. */
function splitTopLevelFields(body: string): string[] {
  const chunks: string[] = [];
  let buf = '';
  let braceDepth = 0;
  let bracketDepth = 0;
  let tabberDepth = 0;

  for (let i = 0; i < body.length; i++) {
    if (body.startsWith('{{', i)) {
      braceDepth++;
      buf += '{{';
      i++;
      continue;
    }
    if (body.startsWith('}}', i)) {
      braceDepth = Math.max(0, braceDepth - 1);
      buf += '}}';
      i++;
      continue;
    }
    if (body.startsWith('[[', i)) {
      bracketDepth++;
      buf += '[[';
      i++;
      continue;
    }
    if (body.startsWith(']]', i)) {
      bracketDepth = Math.max(0, bracketDepth - 1);
      buf += ']]';
      i++;
      continue;
    }
    if (/^<tabber>/i.test(body.slice(i))) {
      tabberDepth++;
    } else if (/^<\/tabber>/i.test(body.slice(i))) {
      tabberDepth = Math.max(0, tabberDepth - 1);
    }

    const ch = body[i];
    if (ch === '|' && braceDepth === 0 && bracketDepth === 0 && tabberDepth === 0) {
      chunks.push(buf);
      buf = '';
      continue;
    }
    buf += ch;
  }
  chunks.push(buf);
  return chunks;
}

function cleanValue(raw: string): string {
  return raw
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .trim();
}

export function parseInfobox(wikitext: string): Record<string, string> | null {
  const body = extractTemplateBody(wikitext);
  if (body === null) return null;

  const infobox: Record<string, string> = {};
  for (const chunk of splitTopLevelFields(body)) {
    const eq = chunk.indexOf('=');
    if (eq === -1) continue; // stray pipe with no "key =", ignore
    const key = chunk.slice(0, eq).trim().toLowerCase();
    if (!key) continue;
    infobox[key] = cleanValue(chunk.slice(eq + 1));
  }
  return infobox;
}
