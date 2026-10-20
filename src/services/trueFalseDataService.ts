import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { normalizeText } from './questionsDataService';

// "Утверждение -> верно?" quiz mode, with an optional media prompt alongside
// the text. See docs/question-types.md "Что реально реализовано": a
// separate file/service like whoisDataService.ts, because correct: boolean
// with no answer_options doesn't fit the main schema.
const trueFalseSchema = z.object({
  id: z.number().int().positive(),
  statement: z.string().min(1),
  promptMedia: z
    .object({ url: z.url(), kind: z.enum(['image', 'video']) })
    .nullable()
    .default(null),
  correct: z.boolean(),
});

export type TrueFalseQuestion = z.infer<typeof trueFalseSchema>;

let items: TrueFalseQuestion[] = [];
const byId = new Map<number, TrueFalseQuestion>();
const byStatement = new Map<string, TrueFalseQuestion>();

/** Loads and indexes true/false statements. Throws if the file exists but is malformed. */
export function loadTrueFalse(filePath: string) {
  const absolute = path.resolve(filePath);
  let raw: string;
  try {
    raw = fs.readFileSync(absolute, 'utf8');
  } catch (err) {
    throw new Error(`Не удалось прочитать файл утверждений ${absolute}: ${(err as Error).message}`, { cause: err });
  }

  const parsed = z.array(trueFalseSchema).min(1).safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error(`Файл утверждений ${absolute} некорректен:\n${z.prettifyError(parsed.error)}`);
  }

  items = parsed.data;
  byId.clear();
  byStatement.clear();

  for (const it of items) {
    if (byId.has(it.id)) throw new Error(`Дублирующийся id утверждения: ${it.id}`);
    byId.set(it.id, it);

    const key = normalizeText(it.statement);
    if (byStatement.has(key)) {
      throw new Error(`Дублирующийся текст утверждения (id ${it.id} и id ${byStatement.get(key)!.id})`);
    }
    byStatement.set(key, it);
  }

  return items.length;
}

export function getById(id: number): TrueFalseQuestion | undefined {
  return byId.get(id);
}

export function getRandomTrueFalse(): TrueFalseQuestion | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

export function allTrueFalse(): TrueFalseQuestion[] {
  return items.slice();
}

export default {
  loadTrueFalse,
  getById,
  getRandomTrueFalse,
  allTrueFalse,
};
