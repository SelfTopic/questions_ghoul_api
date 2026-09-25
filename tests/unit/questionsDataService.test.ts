import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import * as questions from '../../src/services/questionsDataService';

const fixture = 'tests/fixtures/questions.json';
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'questions-'));

function writeTmp(name: string, content: unknown) {
  const file = path.join(tmpDir, name);
  fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
  return file;
}

afterAll(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

describe('normalizeText', () => {
  it.each([
    ['  Какого цвета ЁЛКА?  ', 'какого цвета елка'],
    ['«Кто»   это — такой?!', 'кто это такой'],
    ['Сколько будет 2 + 2?', 'сколько будет 2 2'],
  ])('%s → %s', (input, expected) => {
    expect(questions.normalizeText(input)).toBe(expected);
  });
});

describe('loadQuestions', () => {
  beforeEach(() => {
    questions.loadQuestions(fixture);
  });

  it('loads and indexes the fixture', () => {
    expect(questions.allQuestions()).toHaveLength(3);
    expect(questions.getById(1)?.answer).toBe('Зелёная');
    expect(questions.getById(999)).toBeUndefined();
  });

  it('finds questions regardless of case, ё, punctuation and spaces', () => {
    expect(questions.getByQuestion('тестовый вопрос  КАКОГО цвета елка')?.id).toBe(1);
    expect(questions.getByQuestion('Совсем другой вопрос')).toBeUndefined();
  });

  it('finds questions by answer options in any order', () => {
    expect(questions.getByAnswers(['22', '5', '4', '3']).map((q) => q.id)).toEqual([3]);
  });

  it('random question comes from the loaded set', () => {
    const ids = new Set(questions.allQuestions().map((q) => q.id));
    for (let i = 0; i < 20; i++) expect(ids.has(questions.getRandomQuestion()!.id)).toBe(true);
  });

  it('allQuestions returns a copy', () => {
    questions.allQuestions().pop();
    expect(questions.allQuestions()).toHaveLength(3);
  });

  it('throws on a missing file', () => {
    expect(() => questions.loadQuestions(path.join(tmpDir, 'nope.json'))).toThrow(/Не удалось прочитать/);
  });

  it('throws on an empty list', () => {
    expect(() => questions.loadQuestions(writeTmp('empty.json', []))).toThrow(/некорректен/);
  });

  it('throws on malformed items', () => {
    expect(() => questions.loadQuestions(writeTmp('bad.json', [{ id: 'x', question: 1 }]))).toThrow(/некорректен/);
  });

  it('throws on invalid JSON', () => {
    expect(() => questions.loadQuestions(writeTmp('broken.json', '{not json'))).toThrow();
  });

  it('throws on duplicate ids', () => {
    const q = { id: 1, question: 'a', answer: 'b', answer_options: ['b'] };
    expect(() => questions.loadQuestions(writeTmp('dup.json', [q, { ...q, question: 'c' }]))).toThrow(
      /Дублирующийся id/,
    );
  });
});
