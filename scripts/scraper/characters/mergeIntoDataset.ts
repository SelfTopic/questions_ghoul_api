import fs from 'fs';
import path from 'path';

// Secret, never committed - must already exist locally (docs/README.md).
const EXISTING_FILE = path.join(__dirname, '..', '..', '..', 'assets', 'data', 'processed', 'data.json');
const GENERATED_FILE = path.join(__dirname, '..', 'out', 'questions', 'all-with-media.json');
// Written next to the generated pool, not over the real data.json - swap it
// in yourself once you've reviewed it (see docs/question-generation.md).
const OUT_FILE = path.join(__dirname, '..', 'out', 'merged-data.json');

interface GeneratedQuestion {
  character: string;
  question: string;
  answer: string;
  answer_options: string[];
  answerMedia: { file: string; url: string } | null;
}

interface ExistingQuestion {
  id: number;
  question: string;
  answer: string;
  answer_group?: string;
  answer_options: string[];
}

function main() {
  const existing: ExistingQuestion[] = JSON.parse(fs.readFileSync(EXISTING_FILE, 'utf8'));
  const generated: GeneratedQuestion[] = JSON.parse(fs.readFileSync(GENERATED_FILE, 'utf8'));

  let nextId = Math.max(...existing.map((q) => q.id)) + 1;
  const appended = generated.map((q) => ({
    id: nextId++,
    question: q.question,
    answer: q.answer,
    answer_options: q.answer_options,
    answerMedia: q.answerMedia ? { url: q.answerMedia.url, kind: 'image' as const } : null,
  }));

  const merged = [...existing, ...appended];
  fs.writeFileSync(OUT_FILE, JSON.stringify(merged, null, 2), 'utf8');
  console.log(`${existing.length} существующих + ${appended.length} новых = ${merged.length} -> ${OUT_FILE}`);
}

main();
