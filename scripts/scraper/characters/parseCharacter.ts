import type { FetchedPage } from './fetchContent';
import type { ScrapedCharacter } from './types';
import { parseInfobox } from './parseInfobox';
import { parseQuotes } from './parseQuotes';

export function parseCharacter(page: FetchedPage): ScrapedCharacter | null {
  const infobox = parseInfobox(page.wikitext);
  if (!infobox) {
    console.warn(`⚠️ пропускаю "${page.title}": не нашёл {{Character}} в инфобоксе`);
    return null;
  }

  return {
    pageId: page.pageId,
    title: page.title,
    categories: page.categories,
    infobox,
    quotes: parseQuotes(page.wikitext),
  };
}
