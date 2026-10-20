import fs from 'fs';
import path from 'path';
import { fetchContent } from './fetchContent';
import { extractProse } from './extractProse';
import type { ScrapedCharacter } from './types';

// Mix of major (rich prose) and minor/stub (thin prose) characters, to see
// where the "not enough material" cutoff should be.
const PILOT_TITLES = [
  'Кен Канеки',
  'Тоука Киришима',
  'Шу Цукияма',
  'Норо',
  'Мать Кена Канеки',
  'Акира Мадо',
  'Хинами Фуегучи',
  'Юкинори Шинохара',
  'Джузо Сузуя',
  'Нишики Нишио',
  'Итори',
  'Куреа Мадо',
];

const CHARACTERS_FILE = path.join(__dirname, '..', 'out', 'characters.json');
const OUT_FILE = path.join(__dirname, '..', 'out', 'pilot-bundles.json');

async function main() {
  const allCharacters: ScrapedCharacter[] = JSON.parse(fs.readFileSync(CHARACTERS_FILE, 'utf8'));
  const byTitle = new Map(allCharacters.map((c) => [c.title, c]));

  const pages = await fetchContent(PILOT_TITLES);

  const bundles = pages.map((page) => {
    const scraped = byTitle.get(page.title);
    return {
      title: page.title,
      prose: extractProse(page.wikitext),
      infobox: scraped?.infobox ?? {},
      quotes: scraped?.quotes ?? [],
    };
  });

  fs.writeFileSync(OUT_FILE, JSON.stringify(bundles, null, 2), 'utf8');
  for (const b of bundles) {
    console.log(`${b.title}: проза ${b.prose.length} симв., цитат ${b.quotes.length}`);
  }
  console.log(`-> ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
