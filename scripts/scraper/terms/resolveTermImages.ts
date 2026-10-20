import fs from 'fs';
import path from 'path';
import { listTermTitles } from './listTitles';
import { fetchContent } from '../characters/fetchContent';
import { resolveImageUrls } from '../characters/resolveImages';

const OUT_FILE = path.join(__dirname, '..', 'out', 'terms-images.json');
const FILE_REF = /\[\[(?:File|Файл):([^|\]]+)/gi;

function extractFileNames(wikitext: string): string[] {
  return [...new Set([...wikitext.matchAll(FILE_REF)].map((m) => m[1].trim()))];
}

async function main() {
  const titles = await listTermTitles();
  const pages = await fetchContent(titles);

  const filesByTerm = new Map(pages.map((p) => [p.title, extractFileNames(p.wikitext)]));
  const allFileNames = [...filesByTerm.values()].flat();
  const urlByName = await resolveImageUrls(allFileNames);

  const result = [...filesByTerm.entries()]
    .map(([title, files]) => ({
      title,
      images: files.map((file) => ({ file, url: urlByName.get(file) ?? null })).filter((i) => i.url),
    }))
    .filter((t) => t.images.length > 0);

  fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2), 'utf8');
  console.log(`${result.length} терминов с резолвленными картинками -> ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
