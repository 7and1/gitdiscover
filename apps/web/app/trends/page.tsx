import type { Metadata } from "next";
import Link from "next/link";
import { apiGetServer } from "../../lib/server-api";
import type { TrendsGrowthResponse, TrendsLanguagesResponse, TrendsTopicsResponse } from "../../lib/types";
import { LanguageTrendsChart } from "../../components/language-trends-chart";
import { getAppUrl } from "../../lib/env";

export const metadata: Metadata = {
  title: "Trends",
  description: "Language, topic, and growth trends based on daily repository snapshots.",
  alternates: { canonical: `${getAppUrl()}/trends` },
};

function asString(v: string | string[] | undefined): string | undefined {
  if (typeof v === "string") return v;
  return undefined;
}

function buildQuery(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "") continue;
    qs.set(k, v);
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export default async function TrendsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const period = asString(searchParams?.period) ?? "weekly";
  const metric = asString(searchParams?.metric) ?? "stars";

  const [langs, topics, growth] = await Promise.all([
    apiGetServer<TrendsLanguagesResponse>(`/trends/languages${buildQuery({ period })}`, { next: { revalidate: 3600 } }),
    apiGetServer<TrendsTopicsResponse>(`/trends/topics${buildQuery({ period })}`, { next: { revalidate: 3600 } }),
    apiGetServer<TrendsGrowthResponse>(
      `/trends/growth${buildQuery({ period: period === "weekly" ? "daily" : period, metric, limit: "10" })}`,
      { next: { revalidate: 3600 } }
    ).catch(() => ({ data: [], metric, period: period === "weekly" ? "daily" : period } as TrendsGrowthResponse)),
  ]);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Trends</h1>
        <p className="text-sm text-muted-foreground">Language and topic momentum plus growth leaderboards.</p>
      </header>

      <form className="flex flex-wrap gap-3 rounded-lg border border-border bg-background p-4" method="get">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Period
          <select
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            defaultValue={period}
            name="period"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Growth metric
          <select
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            defaultValue={metric}
            name="metric"
          >
            <option value="stars">Stars</option>
            <option value="forks">Forks</option>
            <option value="score">Score</option>
          </select>
        </label>

        <button
          className="self-end rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
          type="submit"
        >
          Apply
        </button>
      </form>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Language trends</h2>
          <div className="text-xs text-muted-foreground">Generated {new Date(langs.generatedAt).toISOString()}</div>
        </div>

        <div className="rounded-lg border border-border bg-background p-4 text-foreground">
          <LanguageTrendsChart data={langs.data} />
        </div>

        <div className="overflow-x-auto rounded-lg border border-border bg-background">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Language</th>
                <th className="px-4 py-3">Repos</th>
                <th className="px-4 py-3">Stars</th>
                <th className="px-4 py-3">Growth</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {langs.data.slice(0, 15).map((l) => (
                <tr key={l.language}>
                  <td className="px-4 py-3">{l.language}</td>
                  <td className="px-4 py-3">{l.repos.toLocaleString("en")}</td>
                  <td className="px-4 py-3">{l.stars.toLocaleString("en")}</td>
                  <td className="px-4 py-3">
                    <span className={l.trend === "up" ? "text-green-500" : l.trend === "down" ? "text-red-500" : ""}>
                      {l.growth}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Topic trends</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {topics.data.slice(0, 20).map((t) => (
            <div key={t.topic} className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium">{t.topic}</div>
                <div className="text-sm text-muted-foreground">{t.growth}%</div>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{t.repos.toLocaleString("en")} repos</div>
              {t.relatedTopics.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {t.relatedTopics.map((rt) => (
                    <span key={rt} className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
                      {rt}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Growth leaderboard</h2>
        {growth.data.length ? (
          <div className="overflow-x-auto rounded-lg border border-border bg-background">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Repository</th>
                  <th className="px-4 py-3">Growth</th>
                  <th className="px-4 py-3">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {growth.data.map((g) => (
                  <tr key={g.repository.id}>
                    <td className="px-4 py-3">{g.rank}</td>
                    <td className="px-4 py-3">
                      <Link
                        className="hover:underline"
                        href={`/repositories/${g.repository.fullName
                          .split("/")
                          .map((s) => encodeURIComponent(s))
                          .join("/")}`}
                      >
                        {g.repository.fullName}
                      </Link>
                      <div className="text-xs text-muted-foreground">{g.repository.language ?? "Unknown language"}</div>
                    </td>
                    <td className="px-4 py-3">{g.growth.toLocaleString("en")}</td>
                    <td className="px-4 py-3">{g.growthPercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Not enough history yet to compute growth.</p>
        )}
      </section>
    </div>
  );
}

