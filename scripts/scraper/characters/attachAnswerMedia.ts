import fs from 'fs';
import path from 'path';
import type { ScrapedCharacter } from './types';

interface GeneratedQuestion {
  character: string;
  question: string;
  answer: string;
  answer_options: string[];
}

interface QuestionWithMedia extends GeneratedQuestion {
  answerMedia: { file: string; url: string } | null;
}

const CHARACTERS_FILE = path.join(__dirname, '..', 'out', 'characters.json');
const QUESTIONS_FILE = path.join(__dirname, '..', 'out', 'questions', 'all.json');
const OUT_FILE = path.join(__dirname, '..', 'out', 'questions', 'all-with-media.json');

function main() {
  const characters: ScrapedCharacter[] = JSON.parse(fs.readFileSync(CHARACTERS_FILE, 'utf8'));
  const questions: GeneratedQuestion[] = JSON.parse(fs.readFileSync(QUESTIONS_FILE, 'utf8'));

  // One illustrative image per character - whichever was resolved first (no
  // particular field preference, see docs/question-generation.md).
  const imageByTitle = new Map<string, { file: string; url: string }>();
  for (const c of characters) {
    const first = c.images.find((i) => i.url);
    if (first?.url) imageByTitle.set(c.title, { file: first.file, url: first.url });
  }

  let matched = 0;
  const withMedia: QuestionWithMedia[] = questions.map((q) => {
    const image = imageByTitle.get(q.answer) ?? null;
    if (image) matched++;
    return { ...q, answerMedia: image };
  });

  fs.writeFileSync(OUT_FILE, JSON.stringify(withMedia, null, 2), 'utf8');
  console.log(`${matched}/${questions.length} вопросов получили answerMedia (ответ совпал с именем персонажа с фото)`);
  console.log(`-> ${OUT_FILE}`);
}

main();
