import fs from 'fs';
import path from 'path';
import { fetchContent } from './fetchContent';
import { extractProse } from './extractProse';
import type { ScrapedCharacter } from './types';

const CHARACTERS_FILE = path.join(__dirname, '..', 'out', 'characters.json');
const BUNDLES_DIR = path.join(__dirname, '..', 'out', 'bundles');
const BATCH_SIZE = 20;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function main() {
  const characters: ScrapedCharacter[] = JSON.parse(fs.readFileSync(CHARACTERS_FILE, 'utf8'));

  console.log(`Проза для ${characters.length} персонажей...`);
  const pages = await fetchContent(characters.map((c) => c.title));
  const proseByTitle = new Map(pages.map((p) => [p.title, extractProse(p.wikitext)]));

  const bundles = characters.map((c) => ({
    title: c.title,
    prose: proseByTitle.get(c.title) ?? '',
    infobox: c.infobox,
    quotes: c.quotes,
    images: c.images.filter((i) => i.url).map((i) => ({ file: i.file, url: i.url })),
  }));

  fs.mkdirSync(BUNDLES_DIR, { recursive: true });
  const batches = chunk(bundles, BATCH_SIZE);
  batches.forEach((batch, i) => {
    const file = path.join(BUNDLES_DIR, `batch-${String(i + 1).padStart(2, '0')}.json`);
    fs.writeFileSync(file, JSON.stringify(batch, null, 2), 'utf8');
  });

  console.log(`${bundles.length} бандлов -> ${batches.length} батчей по ${BATCH_SIZE} в ${BUNDLES_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
