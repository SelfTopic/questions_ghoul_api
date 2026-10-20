import fs from 'fs';
import path from 'path';
import { z } from 'zod';

const questionSchema = z
  .object({
    id: z.number().int().positive(),
    question: z.string().min(1),
    answer: z.string().min(1),
    answer_group: z.string().optional(),
    // 2-10, not a fixed 4 - see docs/data-quality.md.
    answer_options: z.array(z.string().min(1)).min(2).max(10),
    // Illustration for the correct answer (docs/question-types.md); null when
    // none is available, never missing, so clients don't need an undefined check.
    answerMedia: z
      .object({ url: z.url(), kind: z.enum(['image', 'video']) })
      .nullable()
      .default(null),
  })
  .refine((q) => q.answer_options.includes(q.answer), {
    error: 'answer должен входить в answer_options',
    path: ['answer'],
  });

export type Question = z.infer<typeof questionSchema>;

let items: Question[] = [];
const byId = new Map<number, Question>();
const byQuestion = new Map<string, Question>();
const answersIndex = new Map<string, Question[]>();

// Case, "ё", punctuation and whitespace differences should not break lookups.
export function normalizeText(s: string) {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function answersKey(arr: string[]) {
  return arr.map(normalizeText).sort().join('||');
}

/** Loads and indexes questions. Throws if the file is missing or malformed. */
export function loadQuestions(filePath: string) {
  const absolute = path.resolve(filePath);
  let raw: string;
  try {
    raw = fs.readFileSync(absolute, 'utf8');
  } catch (err) {
    throw new Error(`Не удалось прочитать файл вопросов ${absolute}: ${(err as Error).message}`, { cause: err });
  }

  const parsed = z.array(questionSchema).min(1).safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error(`Файл вопросов ${absolute} некорректен:\n${z.prettifyError(parsed.error)}`);
  }

  items = parsed.data;
  byId.clear();
  byQuestion.clear();
  answersIndex.clear();

  for (const it of items) {
    if (byId.has(it.id)) throw new Error(`Дублирующийся id вопроса: ${it.id}`);
    byId.set(it.id, it);

    const qKey = normalizeText(it.question);
    if (byQuestion.has(qKey)) {
      throw new Error(`Дублирующийся текст вопроса (id ${it.id} и id ${byQuestion.get(qKey)!.id})`);
    }
    byQuestion.set(qKey, it);

    const key = answersKey(it.answer_options);
    const bucket = answersIndex.get(key) || [];
    bucket.push(it);
    answersIndex.set(key, bucket);
  }

  return items.length;
}

export function getById(id: number): Question | undefined {
  return byId.get(id);
}

export function getByQuestion(question: string): Question | undefined {
  return byQuestion.get(normalizeText(question));
}

export function getRandomQuestion(): Question | undefined {
  if (items.length === 0) return undefined;
  const idx = Math.floor(Math.random() * items.length);
  return items[idx];
}

export function getByAnswers(answers: string[]): Question[] {
  return answersIndex.get(answersKey(answers)) || [];
}

export function allQuestions(): Question[] {
  return items.slice();
}

export default {
  loadQuestions,
  getById,
  getByQuestion,
  getRandomQuestion,
  getByAnswers,
  allQuestions,
};
