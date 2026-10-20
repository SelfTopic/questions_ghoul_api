import fs from 'fs';
import path from 'path';
import { listTermTitles } from './listTitles';
import { fetchContent } from '../characters/fetchContent';
import { extractDefinition } from './extractDefinition';

const OUT_FILE = path.join(__dirname, '..', 'out', 'terms.json');

async function main() {
  console.log('Список терминов...');
  const titles = await listTermTitles();
  console.log(`  ${titles.length} страниц в Категория:Термины`);

  console.log('Контент...');
  const pages = await fetchContent(titles);

  const terms = pages.map((p) => ({ title: p.title, definition: extractDefinition(p.wikitext) }));

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(terms, null, 2), 'utf8');

  for (const t of terms) console.log(`${t.title}: ${t.definition.length} симв.`);
  console.log(`-> ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
