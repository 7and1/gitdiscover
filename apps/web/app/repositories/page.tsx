import type { Metadata } from "next";
import Link from "next/link";
import { apiGetServer } from "../../lib/server-api";
import type { RepoListResponse, RepoSearchResponse } from "../../lib/types";
import { RepoCard } from "../../components/repo-card";
import { RepoSearchCard } from "../../components/repo-search-card";
import { getAppUrl } from "../../lib/env";

export const metadata: Metadata = {
  title: "Trending Repositories",
  description: "Browse trending GitHub repositories by score, stars, forks, and growth. Filter by language and period.",
  alternates: { canonical: `${getAppUrl()}/repositories` },
};

const TOP_LANGUAGES = [
  "JavaScript",
  "TypeScript",
  "Python",
  "Go",
  "Rust",
  "Java",
  "C++",
  "C#",
  "PHP",
  "Ruby",
] as const;

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

export default async function RepositoriesPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const q = asString(searchParams?.q)?.trim() ?? "";
  const language = asString(searchParams?.language);
  const sort = asString(searchParams?.sort) ?? "score";
  const period = asString(searchParams?.period) ?? "daily";
  const limit = asString(searchParams?.limit) ?? "20";
  const cursor = asString(searchParams?.cursor);

  const isSearch = q.length > 0;

  const searchData = isSearch
    ? await apiGetServer<RepoSearchResponse>(`/repositories/search${buildQuery({ q, language, limit })}`, {
        next: { revalidate: 300 },
      })
    : null;

  const listData = !isSearch
    ? await apiGetServer<RepoListResponse>(`/repositories${buildQuery({ language, sort, period, limit, cursor })}`, {
        next: { revalidate: 300 },
      })
    : null;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Repositories</h1>
        <p className="text-sm text-muted-foreground">
          Daily trending projects with simple ranking + community signals.
        </p>
      </header>

      <form className="grid gap-3 rounded-lg border border-border bg-background p-4 md:grid-cols-12" method="get">
        <div className="md:col-span-5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="q">
            Search
          </label>
          <input
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
            defaultValue={q}
            id="q"
            name="q"
            placeholder="Search repositories (name or description)…"
            type="search"
          />
        </div>

        <div className="md:col-span-3">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="language">
            Language
          </label>
          <select
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            defaultValue={language ?? ""}
            id="language"
            name="language"
          >
            <option value="">All</option>
            {TOP_LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="period">
            Period
          </label>
          <select
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            defaultValue={period}
            id="period"
            name="period"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="sort">
            Sort
          </label>
          <select
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            defaultValue={sort}
            id="sort"
            name="sort"
            disabled={isSearch}
            title={isSearch ? "Search results are sorted by relevance." : undefined}
          >
            <option value="score">Score</option>
            <option value="growth">Growth</option>
            <option value="stars">Stars</option>
            <option value="forks">Forks</option>
          </select>
        </div>

        <div className="md:col-span-12 flex flex-wrap items-center gap-3 pt-1">
          <button
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
            type="submit"
          >
            Apply
          </button>

          {cursor ? (
            <Link className="text-sm text-muted-foreground hover:text-foreground" href="/repositories">
              Reset pagination
            </Link>
          ) : null}

          {isSearch ? (
            <Link className="text-sm text-muted-foreground hover:text-foreground" href="/repositories">
              Clear search
            </Link>
          ) : null}
        </div>
      </form>

      {isSearch && searchData ? (
        <>
          <div className="text-sm text-muted-foreground">
            {searchData.total.toLocaleString("en")} results for{" "}
            <span className="text-foreground">“{searchData.query}”</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {searchData.data.map((r) => (
              <RepoSearchCard key={r.id} repo={r} />
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {listData?.data.map((r) => (
              <RepoCard key={r.id} repo={r} />
            ))}
          </div>

          {listData?.hasMore ? (
            <div className="flex justify-center pt-2">
              <Link
                className="rounded-md border border-border bg-background px-4 py-2 text-sm hover:bg-muted"
                href={`/repositories${buildQuery({
                  language,
                  sort,
                  period,
                  limit,
                  cursor: listData.cursor ?? undefined,
                })}`}
              >
                Next page →
              </Link>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
