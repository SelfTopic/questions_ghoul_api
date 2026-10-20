import fs from 'fs';
import path from 'path';
import { z } from 'zod';

// "Кто/что это?" quiz mode: the prompt is a photo, not text, so there's no
// question string to dedupe on like in questionsDataService - clients look
// these up by id only. See docs/question-types.md.
const whoisSchema = z
  .object({
    id: z.number().int().positive(),
    promptMedia: z.object({ url: z.url(), kind: z.enum(['image', 'video']) }),
    answer: z.string().min(1),
    answer_options: z.array(z.string().min(1)).min(2).max(10),
  })
  .refine((q) => q.answer_options.includes(q.answer), {
    error: 'answer должен входить в answer_options',
    path: ['answer'],
  });

export type WhoisQuestion = z.infer<typeof whoisSchema>;

let items: WhoisQuestion[] = [];
const byId = new Map<number, WhoisQuestion>();

/** Loads and indexes the whois questions. Throws if the file exists but is malformed. */
export function loadWhois(filePath: string) {
  const absolute = path.resolve(filePath);
  let raw: string;
  try {
    raw = fs.readFileSync(absolute, 'utf8');
  } catch (err) {
    throw new Error(`Не удалось прочитать файл "кто это" ${absolute}: ${(err as Error).message}`, { cause: err });
  }

  const parsed = z.array(whoisSchema).min(1).safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error(`Файл "кто это" ${absolute} некорректен:\n${z.prettifyError(parsed.error)}`);
  }

  items = parsed.data;
  byId.clear();
  for (const it of items) {
    if (byId.has(it.id)) throw new Error(`Дублирующийся id вопроса "кто это": ${it.id}`);
    byId.set(it.id, it);
  }

  return items.length;
}

export function getById(id: number): WhoisQuestion | undefined {
  return byId.get(id);
}

export function getRandomWhois(): WhoisQuestion | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

export function allWhois(): WhoisQuestion[] {
  return items.slice();
}

export default {
  loadWhois,
  getById,
  getRandomWhois,
  allWhois,
};
