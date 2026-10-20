import fs from 'fs';
import path from 'path';
import { listCharacterTitles } from './listTitles';
import { fetchContent } from './fetchContent';
import { parseCharacter } from './parseCharacter';
import { resolveImageUrls } from './resolveImages';
import type { ScrapedCharacter } from './types';

const OUT_FILE = path.join(__dirname, '..', 'out', 'characters.json');

async function main() {
  console.log('Список персонажей...');
  const titles = await listCharacterTitles();
  console.log(`  ${titles.length} страниц в Категория:Персонажи`);

  console.log('Контент и категории...');
  const pages = await fetchContent(titles);
  console.log(`  получено ${pages.length} страниц`);

  const characters: ScrapedCharacter[] = [];
  for (const page of pages) {
    const character = parseCharacter(page);
    if (character) characters.push(character);
  }

  console.log('Картинки...');
  const allFileNames = characters.flatMap((c) => c.images.map((img) => img.file));
  const urlByName = await resolveImageUrls(allFileNames);
  for (const character of characters) {
    for (const img of character.images) img.url = urlByName.get(img.file) ?? null;
  }
  const resolvedImages = characters.reduce((sum, c) => sum + c.images.filter((i) => i.url).length, 0);
  console.log(`  ${urlByName.size}/${new Set(allFileNames).size} уникальных файлов отрезолвлено`);

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(characters, null, 2), 'utf8');

  const totalQuotes = characters.reduce((sum, c) => sum + c.quotes.length, 0);
  console.log(
    `Готово: ${characters.length}/${pages.length} распарсено, ${totalQuotes} цитат, ${resolvedImages} картинок всего.`,
  );
  console.log(`-> ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
