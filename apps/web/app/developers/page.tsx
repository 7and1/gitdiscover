import type { Metadata } from "next";
import Link from "next/link";
import { apiGetServer } from "../../lib/server-api";
import type { DeveloperListResponse } from "../../lib/types";
import { DeveloperCard } from "../../components/developer-card";
import { getAppUrl } from "../../lib/env";

export const metadata: Metadata = {
  title: "Top Developers",
  description: "Discover top open-source developers ranked by impact, followers, and stars.",
  alternates: { canonical: `${getAppUrl()}/developers` },
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

export default async function DevelopersPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const sort = asString(searchParams?.sort) ?? "impact";
  const limit = asString(searchParams?.limit) ?? "30";
  const cursor = asString(searchParams?.cursor);

  const devs = await apiGetServer<DeveloperListResponse>(
    `/developers${buildQuery({ sort, limit, cursor })}`,
    { next: { revalidate: 300 } }
  );

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Developers</h1>
        <p className="text-sm text-muted-foreground">Top builders ranked by impact, stars, and community reach.</p>
      </header>

      <form className="flex flex-wrap gap-3 rounded-lg border border-border bg-background p-4" method="get">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Sort
          <select
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            defaultValue={sort}
            name="sort"
          >
            <option value="impact">Impact</option>
            <option value="followers">Followers</option>
            <option value="stars">Stars</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Limit
          <select
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            defaultValue={limit}
            name="limit"
          >
            <option value="10">10</option>
            <option value="30">30</option>
            <option value="50">50</option>
          </select>
        </label>

        <button
          className="self-end rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
          type="submit"
        >
          Apply
        </button>

        {cursor ? (
          <Link className="self-end text-sm text-muted-foreground hover:text-foreground" href="/developers">
            Reset pagination
          </Link>
        ) : null}
      </form>

      <div className="grid gap-4 md:grid-cols-2">
        {devs.data.map((d) => (
          <DeveloperCard key={d.id} dev={d} />
        ))}
      </div>

      {devs.hasMore ? (
        <div className="flex justify-center pt-2">
          <Link
            className="rounded-md border border-border bg-background px-4 py-2 text-sm hover:bg-muted"
            href={`/developers${buildQuery({ sort, limit, cursor: devs.cursor ?? undefined })}`}
          >
            Next page →
          </Link>
        </div>
      ) : null}
    </div>
  );
}

