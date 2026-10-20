// Thin client for the Russian Tokyo Ghoul wiki's MediaWiki API. The rendered
// /wiki/ pages sit behind a Cloudflare JS challenge, but api.php doesn't
// (see docs/fandom-data.md) - this is the only entry point the scraper uses.
const BASE_URL = 'https://tokyoghoul.fandom.com/ru/api.php';
const USER_AGENT = 'questions-ghoul-api-scraper/0.1 (+https://github.com/SelfTopic/questions_ghoul_api)';

export async function fandomApi<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(BASE_URL);
  for (const [key, value] of Object.entries({ format: 'json', ...params })) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Fandom API ${res.status} ${res.statusText} for ${url.toString()}`);

  const body = (await res.json()) as T & { error?: { code: string; info: string } };
  if (body && typeof body === 'object' && 'error' in body && body.error) {
    throw new Error(`Fandom API error ${body.error.code}: ${body.error.info}`);
  }
  return body;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
