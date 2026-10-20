import { fandomApi, sleep } from '../fandomApi';

interface CategoryMembersResponse {
  query: { categorymembers: { pageid: number; title: string }[] };
  continue?: { cmcontinue: string };
}

const TERMS_CATEGORY = 'Категория:Термины';

/** All page titles in Категория:Термины - the second scraping target after characters. */
export async function listTermTitles(): Promise<string[]> {
  const titles: string[] = [];
  let cmcontinue: string | undefined;

  do {
    const res = await fandomApi<CategoryMembersResponse>({
      action: 'query',
      list: 'categorymembers',
      cmtitle: TERMS_CATEGORY,
      cmtype: 'page',
      cmlimit: '500',
      ...(cmcontinue ? { cmcontinue } : {}),
    });
    titles.push(...res.query.categorymembers.map((m) => m.title));
    cmcontinue = res.continue?.cmcontinue;
    if (cmcontinue) await sleep(300);
  } while (cmcontinue);

  return titles;
}
