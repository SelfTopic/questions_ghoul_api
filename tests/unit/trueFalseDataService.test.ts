import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import * as trueFalse from '../../src/services/trueFalseDataService';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'true-false-'));

function writeTmp(name: string, content: unknown) {
  const file = path.join(tmpDir, name);
  fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
  return file;
}

afterAll(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

const sample = [
  { id: 1, statement: 'Кен Канеки — гуль.', correct: true },
  { id: 2, statement: 'Тоука Киришима — следователь CCG.', correct: false },
];

describe('loadTrueFalse', () => {
  beforeEach(() => {
    trueFalse.loadTrueFalse(writeTmp('sample.json', sample));
  });

  it('loads and indexes the data, defaulting promptMedia to null', () => {
    expect(trueFalse.allTrueFalse()).toHaveLength(2);
    expect(trueFalse.getById(1)?.correct).toBe(true);
    expect(trueFalse.getById(1)?.promptMedia).toBeNull();
    expect(trueFalse.getById(999)).toBeUndefined();
  });

  it('random statement comes from the loaded set', () => {
    const ids = new Set(trueFalse.allTrueFalse().map((q) => q.id));
    for (let i = 0; i < 20; i++) expect(ids.has(trueFalse.getRandomTrueFalse()!.id)).toBe(true);
  });

  it('throws on a missing file', () => {
    expect(() => trueFalse.loadTrueFalse(path.join(tmpDir, 'nope.json'))).toThrow(/Не удалось прочитать/);
  });

  it('throws on duplicate ids', () => {
    const q = sample[0];
    expect(() => trueFalse.loadTrueFalse(writeTmp('dup.json', [q, { ...q, statement: 'Другое.' }]))).toThrow(
      /Дублирующийся id/,
    );
  });

  it('throws on duplicate statement text regardless of case/ё/punctuation', () => {
    const a = { id: 1, statement: 'Один и тот же факт?', correct: true };
    const b = { id: 2, statement: 'ОДИН и тот же факт?!', correct: false };
    expect(() => trueFalse.loadTrueFalse(writeTmp('dupstatement.json', [a, b]))).toThrow(/Дублирующийся текст/);
  });

  it('passes promptMedia through when present', () => {
    const withMedia = {
      id: 1,
      statement: 'У Норо тип кагуне — Бикаку.',
      correct: true,
      promptMedia: { url: 'https://example.com/x.png', kind: 'image' },
    };
    trueFalse.loadTrueFalse(writeTmp('media.json', [withMedia]));
    expect(trueFalse.getById(1)?.promptMedia).toEqual({ url: 'https://example.com/x.png', kind: 'image' });
  });
});
