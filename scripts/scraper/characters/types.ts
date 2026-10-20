export interface ScrapedQuote {
  work: string;
  // Free text before the quote ("Обращаясь к Тоуке", "При первом использовании
  // полукакуджа"...) - not structured further, see docs/fandom-data.md: this
  // wiki doesn't tag quotes by chapter/episode like the English one does.
  context: string | null;
  text: string;
}

export interface ScrapedImage {
  file: string;
  // null if the file reference didn't resolve (renamed/deleted on the wiki).
  url: string | null;
}

export interface ScrapedCharacter {
  pageId: number;
  title: string;
  categories: string[];
  // Raw infobox field -> value, lightly cleaned (refs stripped, <br/> -> \n).
  // Still wikitext (templates/links unresolved) - turning this into clean
  // question-ready text is a later step, not the scraper's job.
  infobox: Record<string, string>;
  quotes: ScrapedQuote[];
  // Every [[File:...]]/[[Файл:...]] referenced anywhere in the infobox
  // (images, era tabs, etc.), resolved to a direct link on Fandom's CDN -
  // we link directly rather than rehosting, see docs/fandom-data.md.
  images: ScrapedImage[];
}
