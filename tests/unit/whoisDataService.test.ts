import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import * as whois from '../../src/services/whoisDataService';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whois-'));

function writeTmp(name: string, content: unknown) {
  const file = path.join(tmpDir, name);
  fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
  return file;
}

afterAll(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

const sample = [
  {
    id: 1,
    promptMedia: { url: 'https://example.com/a.png', kind: 'image' },
    answer: 'Кен Канеки',
    answer_options: ['Кен Канеки', 'Тоука Киришима'],
  },
  {
    id: 2,
    promptMedia: { url: 'https://example.com/b.png', kind: 'image' },
    answer: 'Тоука Киришима',
    answer_options: ['Кен Канеки', 'Тоука Киришима', 'Шу Цукияма'],
  },
];

describe('loadWhois', () => {
  beforeEach(() => {
    whois.loadWhois(writeTmp('sample.json', sample));
  });

  it('loads and indexes the data', () => {
    expect(whois.allWhois()).toHaveLength(2);
    expect(whois.getById(1)?.answer).toBe('Кен Канеки');
    expect(whois.getById(999)).toBeUndefined();
  });

  it('random question comes from the loaded set', () => {
    const ids = new Set(whois.allWhois().map((q) => q.id));
    for (let i = 0; i < 20; i++) expect(ids.has(whois.getRandomWhois()!.id)).toBe(true);
  });

  it('throws on a missing file', () => {
    expect(() => whois.loadWhois(path.join(tmpDir, 'nope.json'))).toThrow(/Не удалось прочитать/);
  });

  it('throws on duplicate ids', () => {
    const q = sample[0];
    expect(() => whois.loadWhois(writeTmp('dup.json', [q, q]))).toThrow(/Дублирующийся id/);
  });

  it('throws on an answer missing from its own options', () => {
    const bad = { ...sample[0], answer: 'Не в списке' };
    expect(() => whois.loadWhois(writeTmp('badanswer.json', [bad]))).toThrow(/некорректен/);
  });

  it('throws when promptMedia is missing', () => {
    const bad = { id: 1, answer: 'x', answer_options: ['x', 'y'] };
    expect(() => whois.loadWhois(writeTmp('nomedia.json', [bad]))).toThrow(/некорректен/);
  });
});
