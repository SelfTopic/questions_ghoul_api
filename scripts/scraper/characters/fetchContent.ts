import { fandomApi, sleep } from '../fandomApi';

export interface FetchedPage {
  pageId: number;
  title: string;
  wikitext: string;
  categories: string[];
}

interface QueryPagesResponse {
  query: {
    pages: Record<
      string,
      {
        pageid: number;
        title: string;
        missing?: string;
        revisions?: [{ slots: { main: { '*': string } } }];
        categories?: { title: string }[];
      }
    >;
  };
}

// Anonymous requests can batch at most 50 titles per action=query call.
const BATCH_SIZE = 50;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Fetches wikitext + categories for every title, batching 50 at a time. */
export async function fetchContent(titles: string[]): Promise<FetchedPage[]> {
  const pages: FetchedPage[] = [];

  for (const batch of chunk(titles, BATCH_SIZE)) {
    const res = await fandomApi<QueryPagesResponse>({
      action: 'query',
      titles: batch.join('|'),
      prop: 'revisions|categories',
      rvprop: 'content',
      rvslots: 'main',
      cllimit: 'max',
      redirects: '1',
    });

    for (const page of Object.values(res.query.pages)) {
      if (page.missing !== undefined || !page.revisions) {
        console.warn(`⚠️ пропускаю "${page.title}": страница не найдена или без контента`);
        continue;
      }
      pages.push({
        pageId: page.pageid,
        title: page.title,
        wikitext: page.revisions[0].slots.main['*'],
        categories: (page.categories ?? []).map((c) => c.title.replace(/^Категория:/, '')),
      });
    }

    await sleep(300);
  }

  return pages;
}
