import { fandomApi, sleep } from '../fandomApi';

interface CategoryMembersResponse {
  query: { categorymembers: { pageid: number; title: string }[] };
  continue?: { cmcontinue: string };
}

const CHARACTERS_CATEGORY = 'Категория:Персонажи';

/** All page titles in Категория:Персонажи - the MVP scrape target (see docs/fandom-data.md). */
export async function listCharacterTitles(): Promise<string[]> {
  const titles: string[] = [];
  let cmcontinue: string | undefined;

  do {
    const res = await fandomApi<CategoryMembersResponse>({
      action: 'query',
      list: 'categorymembers',
      cmtitle: CHARACTERS_CATEGORY,
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
