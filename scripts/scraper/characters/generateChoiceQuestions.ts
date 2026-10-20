import type { ScrapedCharacter } from './types';
import { cleanFieldValue } from './clean';

// Only simple scalar infobox fields - see docs/question-generation.md
// "Решено: с каких полей генерировать вопросы".
const QUESTION_STEM: Record<string, string> = {
  'rc type': 'Какой тип кагуне',
  rating: 'Какой ранг опасности',
  species: 'Какой вид',
  status: 'Какой статус',
  'blood type': 'Какая группа крови',
  age: 'Какой возраст',
  gender: 'Какой пол',
  height: 'Какой рост',
};

// 1 correct + up to 5 distractors; within the 2-10 range decided for choice
// questions (docs/data-quality.md) without needing a huge distractor pool.
const MAX_OPTIONS = 6;

export interface GeneratedQuestion {
  character: string;
  field: string;
  question: string;
  answer: string;
  answer_options: string[];
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** One choice question per character+field, where a clean value exists and
 * at least one other character has a different clean value for the same
 * field to draw a distractor from (see docs/question-generation.md). */
export function generateChoiceQuestions(characters: ScrapedCharacter[]): GeneratedQuestion[] {
  const questions: GeneratedQuestion[] = [];

  for (const field of Object.keys(QUESTION_STEM)) {
    const cleanedByCharacter = new Map<string, string>();
    for (const c of characters) {
      const raw = c.infobox[field];
      const cleaned = raw ? cleanFieldValue(raw) : null;
      if (cleaned) cleanedByCharacter.set(c.title, cleaned);
    }

    const allValues = [...cleanedByCharacter.values()];

    for (const [name, answer] of cleanedByCharacter) {
      const pool = [...new Set(allValues.filter((v) => v !== answer))];
      if (pool.length === 0) continue;

      const distractors = shuffle(pool).slice(0, MAX_OPTIONS - 1);
      questions.push({
        character: name,
        field,
        question: `${QUESTION_STEM[field]} у персонажа «${name}»?`,
        answer,
        answer_options: shuffle([answer, ...distractors]),
      });
    }
  }

  return questions;
}
