import path from 'path';
import * as whois from '../../../src/services/whoisDataService';

const FILE = path.join(__dirname, '..', 'out', 'whois.json');

const count = whois.loadWhois(FILE);
console.log(`Загружено и провалидировано через loadWhois(): ${count}`);
