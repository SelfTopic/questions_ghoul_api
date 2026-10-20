import fs from 'fs';
import path from 'path';
import type { ScrapedCharacter } from './types';

const CHARACTERS_FILE = path.join(__dirname, '..', 'out', 'characters.json');
const OUT_FILE = path.join(__dirname, '..', 'out', 'whois.json');

const OPTIONS_COUNT = 4; // 1 correct + 3 distractors, matching the original dataset's style.

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function main() {
  const characters: ScrapedCharacter[] = JSON.parse(fs.readFileSync(CHARACTERS_FILE, 'utf8'));
  const withImage = characters.filter((c) => c.images.some((i) => i.url));
  const namesWithImage = withImage.map((c) => c.title);

  let id = 1;
  const whois = withImage.map((c) => {
    const image = c.images.find((i) => i.url)!;
    const pool = shuffle(namesWithImage.filter((n) => n !== c.title)).slice(0, OPTIONS_COUNT - 1);
    return {
      id: id++,
      promptMedia: { url: image.url!, kind: 'image' as const },
      answer: c.title,
      answer_options: shuffle([c.title, ...pool]),
    };
  });

  fs.writeFileSync(OUT_FILE, JSON.stringify(whois, null, 2), 'utf8');
  console.log(
    `${whois.length} вопросов "кто это" из ${withImage.length}/${characters.length} персонажей -> ${OUT_FILE}`,
  );
}

main();
