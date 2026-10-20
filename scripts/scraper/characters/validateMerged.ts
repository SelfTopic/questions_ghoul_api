import path from 'path';
import * as questions from '../../../src/services/questionsDataService';

const FILE = path.join(__dirname, '..', 'out', 'merged-data.json');

const count = questions.loadQuestions(FILE);
console.log(`Загружено и провалидировано через loadQuestions(): ${count}`);
