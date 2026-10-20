import fs from 'fs';
import path from 'path';
import { normalizeText } from '../../../src/services/questionsDataService';
import { loadTrueFalse } from '../../../src/services/trueFalseDataService';
import type { ScrapedCharacter } from './types';

const OUT_DIR = path.join(__dirname, '..', 'out');
const BATCHES_DIR = path.join(OUT_DIR, 'true-false');
const CHARACTERS_FILE = path.join(OUT_DIR, 'characters.json');
const OUT_FILE = path.join(OUT_DIR, 'true-false.json');

interface GeneratedStatement {
  subject: string;
  statement: string;
  correct: boolean;
}

const TERMS_DIR = path.join(OUT_DIR, 'true-false-terms');
const TERMS_IMAGES_FILE = path.join(OUT_DIR, 'terms-images.json');

function main() {
  const characters: ScrapedCharacter[] = JSON.parse(fs.readFileSync(CHARACTERS_FILE, 'utf8'));
  const imageByTitle = new Map<string, string | null>(
    characters.map((c) => [c.title, c.images.find((i) => i.url)?.url ?? null]),
  );
  const termImages: { title: string; images: { url: string }[] }[] = JSON.parse(
    fs.readFileSync(TERMS_IMAGES_FILE, 'utf8'),
  );
  for (const t of termImages) imageByTitle.set(t.title, t.images[0]?.url ?? null);

  const batchFiles = fs
    .readdirSync(BATCHES_DIR)
    .filter((f) => /^batch-\d+\.json$/.test(f))
    .sort()
    .map((f) => path.join(BATCHES_DIR, f));
  const termFiles = fs.existsSync(TERMS_DIR)
    ? fs
        .readdirSync(TERMS_DIR)
        .filter((f) => f.endsWith('.json'))
        .map((f) => path.join(TERMS_DIR, f))
    : [];

  const generated: GeneratedStatement[] = [...batchFiles, ...termFiles].flatMap((f) =>
    (JSON.parse(fs.readFileSync(f, 'utf8')) as Record<string, unknown>[]).map((s) => ({
      subject: String(s.character ?? s.term),
      statement: String(s.statement),
      correct: Boolean(s.correct),
    })),
  );

  const seen = new Set<string>();
  const unique = generated.filter((s) => {
    const key = normalizeText(s.statement);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const withIds = unique.map((s, i) => {
    const url = imageByTitle.get(s.subject) ?? null;
    return {
      id: i + 1,
      statement: s.statement,
      promptMedia: url ? { url, kind: 'image' as const } : null,
      correct: s.correct,
    };
  });

  fs.writeFileSync(OUT_FILE, JSON.stringify(withIds, null, 2), 'utf8');
  const count = loadTrueFalse(OUT_FILE);
  console.log(
    `${generated.length} сгенерировано, ${generated.length - unique.length} дублей убрано, ${count} провалидировано через loadTrueFalse(), ` +
      `верных: ${withIds.filter((s) => s.correct).length} -> ${OUT_FILE}`,
  );
}

main();
