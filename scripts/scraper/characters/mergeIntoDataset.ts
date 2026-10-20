import fs from 'fs';
import path from 'path';

// Secret, never committed - must already exist locally (docs/README.md).
const EXISTING_FILE = path.join(__dirname, '..', '..', '..', 'assets', 'data', 'processed', 'data.json');
// Written next to the generated pools, not over the real data.json - swap it
// in yourself once you've reviewed it (see docs/question-generation.md).
const OUT_FILE = path.join(__dirname, '..', 'out', 'merged-data.json');

// Two different generated shapes exist (see docs/fandom-data.md "Вторая волна"):
// characters' answerMedia is {file, url}, terms' is already {url, kind}.
const SOURCES = [
  { file: path.join(__dirname, '..', 'out', 'questions', 'all-with-media.json'), mediaShape: 'file-url' as const },
  { file: path.join(__dirname, '..', 'out', 'terms-questions.json'), mediaShape: 'url-kind' as const },
];

interface GeneratedQuestion {
  question: string;
  answer: string;
  answer_options: string[];
  answerMedia: { file: string; url: string } | { url: string; kind: 'image' | 'video' } | null;
}

interface ExistingQuestion {
  id: number;
  question: string;
  answer: string;
  answer_group?: string;
  answer_options: string[];
}

function normalizeMedia(
  media: GeneratedQuestion['answerMedia'],
  shape: 'file-url' | 'url-kind',
): { url: string; kind: 'image' | 'video' } | null {
  if (!media) return null;
  if (shape === 'url-kind') return media as { url: string; kind: 'image' | 'video' };
  return { url: (media as { file: string; url: string }).url, kind: 'image' };
}

function main() {
  const existing: ExistingQuestion[] = JSON.parse(fs.readFileSync(EXISTING_FILE, 'utf8'));
  let nextId = Math.max(...existing.map((q) => q.id)) + 1;

  const appended = SOURCES.flatMap(({ file, mediaShape }) => {
    const generated: GeneratedQuestion[] = JSON.parse(fs.readFileSync(file, 'utf8'));
    return generated.map((q) => ({
      id: nextId++,
      question: q.question,
      answer: q.answer,
      answer_options: q.answer_options,
      answerMedia: normalizeMedia(q.answerMedia, mediaShape),
    }));
  });

  const merged = [...existing, ...appended];
  fs.writeFileSync(OUT_FILE, JSON.stringify(merged, null, 2), 'utf8');
  console.log(`${existing.length} существующих + ${appended.length} новых = ${merged.length} -> ${OUT_FILE}`);
}

main();
