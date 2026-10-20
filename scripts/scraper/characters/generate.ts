import fs from 'fs';
import path from 'path';
import { generateChoiceQuestions } from './generateChoiceQuestions';
import type { ScrapedCharacter } from './types';

const IN_FILE = path.join(__dirname, '..', 'out', 'characters.json');
const OUT_FILE = path.join(__dirname, '..', 'out', 'choice-questions.json');

function main() {
  const characters: ScrapedCharacter[] = JSON.parse(fs.readFileSync(IN_FILE, 'utf8'));
  const questions = generateChoiceQuestions(characters);

  fs.writeFileSync(OUT_FILE, JSON.stringify(questions, null, 2), 'utf8');
  console.log(`${questions.length} вопросов из ${characters.length} персонажей`);
  console.log(`-> ${OUT_FILE}`);
}

main();
