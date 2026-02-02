import * as cheerio from "cheerio";

export type TrendingSince = "daily" | "weekly" | "monthly";

export interface TrendingRepo {
  fullName: string; // owner/repo
  description: string | null;
  language: string | null;
  starsTotal: number | null;
  forksTotal: number | null;
  starsToday: number | null;
}

export async function fetchTrendingRepos(params: {
  since: TrendingSince;
  languageSlug?: string;
}): Promise<TrendingRepo[]> {
  const url = new URL("https://github.com/trending");
  if (params.languageSlug) url.pathname = `/trending/${params.languageSlug}`;
  url.searchParams.set("since", params.since);

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "gitdiscover-collector/1.0"
    }
  });
  if (!res.ok) throw new Error(`GitHub trending fetch failed: ${res.status}`);
  const html = await res.text();

  const $ = cheerio.load(html);
  const items: TrendingRepo[] = [];

  $("article.Box-row").each((_i, el) => {
    const a = $(el).find("h2 a").first();
    const href = a.attr("href")?.trim() ?? "";
    const fullName = href.replace(/^\//, "");
    if (!fullName.includes("/")) return;

    const description = $(el).find("p").first().text().trim() || null;
    const language = $(el).find('[itemprop="programmingLanguage"]').first().text().trim() || null;

    const starsTotal = parseHumanNumber($(el).find('a[href$="/stargazers"]').first().text());
    const forksTotal = parseHumanNumber($(el).find('a[href$="/forks"]').first().text());

    // Example text: "1,234 stars today"
    const starsTodayText = $(el).find("span.d-inline-block.float-sm-right").first().text().trim();
    const starsToday = parseHumanNumber(starsTodayText.replace(/stars? today/i, "").trim());

    items.push({ fullName, description, language, starsTotal, forksTotal, starsToday });
  });

  return items;
}

function parseHumanNumber(raw: string): number | null {
  const s = raw.replace(/,/g, "").trim().toLowerCase();
  if (!s) return null;

  const m = s.match(/^([0-9]*\\.?[0-9]+)([kmb])?$/);
  if (!m) return null;

  const num = Number(m[1]);
  if (!Number.isFinite(num)) return null;

  const suffix = m[2];
  const mult = suffix === "k" ? 1_000 : suffix === "m" ? 1_000_000 : suffix === "b" ? 1_000_000_000 : 1;
  return Math.round(num * mult);
}

