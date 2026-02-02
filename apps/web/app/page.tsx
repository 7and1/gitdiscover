import Link from "next/link";
import { apiGetServer } from "../lib/server-api";
import type { DeveloperListResponse, RepoListResponse } from "../lib/types";
import { RepoCard } from "../components/repo-card";
import { DeveloperCard } from "../components/developer-card";
import { generateOrganizationSchema, generateWebSiteSchema } from "../lib/jsonld";

export default async function HomePage() {
  const [repos, devs] = await Promise.all([
    apiGetServer<RepoListResponse>("/repositories?limit=10", { next: { revalidate: 300 } }),
    apiGetServer<DeveloperListResponse>("/developers?limit=10", { next: { revalidate: 300 } }),
  ]);

  const webSiteSchema = generateWebSiteSchema();
  const organizationSchema = generateOrganizationSchema();

  return (
    <div className="space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Discover what’s trending on GitHub</h1>
        <p className="max-w-2xl text-muted-foreground">
          Daily top repositories and developers, with community curation and AI insights.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
            href="/repositories"
          >
            Browse repositories
          </Link>
          <Link
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
            href="/trends"
          >
            View trends
          </Link>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Top repositories</h2>
          <Link className="text-sm text-muted-foreground hover:text-foreground" href="/repositories">
            View all →
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {repos.data.map((r) => (
            <RepoCard key={r.id} repo={r} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Top developers</h2>
          <Link className="text-sm text-muted-foreground hover:text-foreground" href="/developers">
            View all →
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {devs.data.map((d) => (
            <DeveloperCard key={d.id} dev={d} />
          ))}
        </div>
      </section>
    </div>
  );
}

