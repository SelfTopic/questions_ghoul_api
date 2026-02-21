import fs from "fs";
import path from "path";

export type Question = {
  id: number;
  question: string;
  answer: string;
  answer_group?: string;
  answer_options: string[];
};

const dataPath = path.join(__dirname, "../../assets/data/processed/data.json");

function loadData(): Question[] {
  try {
    const raw = fs.readFileSync(dataPath, "utf8");
    const parsed = JSON.parse(raw) as Question[];
    return parsed;
  } catch (err) {
    console.error("Failed to load questions data:", err);
    return [];
  }
}

const items = loadData();

const byId = new Map<number, Question>();
const byQuestion = new Map<string, Question>();
const answersIndex = new Map<string, Question[]>();

function normalizeText(s: string) {
  return s.trim().toLowerCase();
}

function answersKey(arr: string[]) {
  return arr.map((s) => normalizeText(s)).sort().join("||");
}

for (const it of items) {
  byId.set(it.id, it);
  byQuestion.set(normalizeText(it.question), it);
  const key = answersKey(it.answer_options || []);
  const bucket = answersIndex.get(key) || [];
  bucket.push(it);
  answersIndex.set(key, bucket);
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
  const key = answersKey(answers || []);
  return answersIndex.get(key) || [];
}

export function allQuestions(): Question[] {
  return items.slice();
}

export default {
  getById,
  getByQuestion,
  getRandomQuestion,
  getByAnswers,
  allQuestions,
};
