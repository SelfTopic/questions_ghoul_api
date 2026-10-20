import { fandomApi, sleep } from '../fandomApi';

interface ImageInfoResponse {
  query: {
    normalized?: { from: string; to: string }[];
    pages: Record<string, { title: string; missing?: string; imageinfo?: [{ url: string }] }>;
  };
}

const BATCH_SIZE = 50;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Resolves bare file names (no "File:"/"Файл:" prefix) to their direct CDN
 * URL, keyed by the exact name passed in so callers can look up with
 * whatever spelling they extracted from wikitext. Unresolvable names
 * (renamed/deleted files) are simply absent from the result. */
export async function resolveImageUrls(fileNames: string[]): Promise<Map<string, string>> {
  const urlByName = new Map<string, string>();
  const unique = [...new Set(fileNames)];

  for (const batch of chunk(unique, BATCH_SIZE)) {
    const res = await fandomApi<ImageInfoResponse>({
      action: 'query',
      titles: batch.map((name) => `File:${name}`).join('|'),
      prop: 'imageinfo',
      iiprop: 'url',
      redirects: '1',
    });

    // "from" is the title we asked for, "to" the form MediaWiki actually used
    // (namespace alias, underscores vs spaces, ...).
    const resolvedTitle = new Map<string, string>();
    for (const n of res.query.normalized ?? []) resolvedTitle.set(n.from, n.to);

    const urlByTitle = new Map<string, string>();
    for (const page of Object.values(res.query.pages)) {
      if (page.missing !== undefined || !page.imageinfo) continue;
      urlByTitle.set(page.title, page.imageinfo[0].url);
    }

    for (const name of batch) {
      const requested = `File:${name}`;
      const url = urlByTitle.get(resolvedTitle.get(requested) ?? requested);
      if (url) urlByName.set(name, url);
    }

    await sleep(300);
  }

  return urlByName;
}
