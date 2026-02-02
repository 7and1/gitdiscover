import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ExternalLink, Globe } from "lucide-react";
import { apiGetServer } from "../../../lib/server-api";
import { getCurrentUser } from "../../../lib/server-auth";
import type {
  BookmarkListResponse,
  CommentListResponse,
  RepoAnalysisResponse,
  RepoDetailResponse,
} from "../../../lib/types";
import { formatCompactNumber, formatIsoDate } from "../../../lib/format";
import { RepoCommunityActions } from "../../../components/repo-community";
import { RepoComments } from "../../../components/repo-comments";
import { getAppUrl } from "../../../lib/env";
import { generateBreadcrumbSchema } from "../../../lib/jsonld";

function parseFullName(parts: string[]): string {
  return parts.map((p) => decodeURIComponent(p)).join("/");
}

export async function generateMetadata({
  params,
}: {
  params: { fullName: string[] };
}): Promise<Metadata> {
  const fullName = parseFullName(params.fullName);
  const encoded = encodeURIComponent(fullName);
  const baseUrl = getAppUrl();

  const repo = await apiGetServer<RepoDetailResponse>(`/repositories/${encoded}`, {
    next: { revalidate: 3600 },
  }).catch(() => null);

  const title = repo?.data.name ? `${repo.data.name} (${repo.data.fullName})` : fullName;
  const description =
    repo?.data.description ??
    "Repository detail page with trending stats, history, community signals, and AI-powered analysis.";
  const canonicalPath = `/repositories/${fullName.split("/").map(encodeURIComponent).join("/")}`;

  return {
    title,
    description,
    alternates: { canonical: `${baseUrl}${canonicalPath}` },
    openGraph: {
      title,
      description,
      type: "article",
      url: `${baseUrl}${canonicalPath}`,
      images: repo?.data.owner?.avatarUrl
        ? [
            {
              url: repo.data.owner.avatarUrl,
              width: 120,
              height: 120,
              alt: `${repo.data.fullName} repository`,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: repo?.data.owner?.avatarUrl ? [repo.data.owner.avatarUrl] : undefined,
    },
  };
}

export default async function RepositoryDetailPage({ params }: { params: { fullName: string[] } }) {
  const fullName = parseFullName(params.fullName);
  const encoded = encodeURIComponent(fullName);

  const repoPromise = apiGetServer<RepoDetailResponse>(`/repositories/${encoded}`, { cache: "no-store" });
  const userPromise = getCurrentUser().catch(() => null);
  const commentsPromise = apiGetServer<CommentListResponse>(`/repositories/${encoded}/comments?limit=20&sort=newest`, {
    cache: "no-store",
  }).catch(() => ({ data: [], cursor: null, hasMore: false } as CommentListResponse));

  const analysisPromise = apiGetServer<RepoAnalysisResponse>(`/repositories/${encoded}/analysis`, {
    cache: "no-store",
  }).catch(() => null);

  const bookmarksPromise = userPromise.then((u) =>
    u ? apiGetServer<BookmarkListResponse>(`/bookmarks`, { cache: "no-store" }).catch(() => null) : null
  );

  const [repoRes, user, comments, analysis, bookmarks] = await Promise.all([
    repoPromise,
    userPromise,
    commentsPromise,
    analysisPromise,
    bookmarksPromise,
  ]);

  const repo = repoRes.data;
  const isBookmarked = Boolean(bookmarks?.data.some((b) => b.repository.id === repo.id));

  const baseUrl = getAppUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareSourceCode",
    name: repo.name,
    description: repo.description ?? undefined,
    codeRepository: `https://github.com/${repo.fullName}`,
    programmingLanguage: repo.language ?? undefined,
    license: repo.license ?? undefined,
    author: repo.owner?.login
      ? { "@type": "Person", name: repo.owner.login, url: `https://github.com/${repo.owner.login}` }
      : undefined,
  };

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: "Home", item: baseUrl },
    { name: "Repositories", item: `${baseUrl}/repositories` },
    { name: repo.fullName, item: `${baseUrl}/repositories/${repo.fullName.split("/").map(encodeURIComponent).join("/")}` },
  ]);

  return (
    <div className="space-y-8">
      <header className="rounded-lg border border-border bg-background p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{repo.fullName}</h1>
            {repo.description ? (
              <p className="max-w-3xl text-sm text-muted-foreground">{repo.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No description.</p>
            )}

            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <a
                className="inline-flex items-center gap-2 hover:text-foreground hover:underline"
                href={`https://github.com/${repo.fullName}`}
                rel="noreferrer"
                target="_blank"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                GitHub
              </a>

              {repo.homepage ? (
                <a
                  className="inline-flex items-center gap-2 hover:text-foreground hover:underline"
                  href={repo.homepage}
                  rel="noreferrer"
                  target="_blank"
                >
                  <Globe className="h-4 w-4" aria-hidden="true" />
                  Homepage
                </a>
              ) : null}

              {repo.owner?.login ? (
                <Link className="hover:text-foreground hover:underline" href={`/developers/${encodeURIComponent(repo.owner.login)}`}>
                  @{repo.owner.login}
                </Link>
              ) : null}
            </div>
          </div>

          {repo.owner?.avatarUrl ? (
            <Image
              alt={`${repo.owner.login} avatar`}
              className="h-14 w-14 shrink-0 rounded-full border border-border"
              src={repo.owner.avatarUrl}
              width={56}
              height={56}
              priority
            />
          ) : (
            <div className="h-14 w-14 shrink-0 rounded-full border border-border bg-muted" />
          )}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Stars" value={formatCompactNumber(repo.stars)} sub={`+${formatCompactNumber(repo.starsGrowth24h)} 24h`} />
          <Stat label="Forks" value={formatCompactNumber(repo.forks)} sub={`+${formatCompactNumber(repo.forksGrowth24h)} 24h`} />
          <Stat label="Watchers" value={formatCompactNumber(repo.watchers)} />
          <Stat label="Score" value={repo.score.toFixed(1)} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {repo.language ? <span className="rounded-md bg-muted px-2 py-1 text-foreground">{repo.language}</span> : null}
          {repo.license ? <span className="rounded-md border border-border px-2 py-1">{repo.license}</span> : null}
          <span className="rounded-md border border-border px-2 py-1">Open issues: {formatCompactNumber(repo.openIssues)}</span>
          <span className="rounded-md border border-border px-2 py-1">Pushed: {formatIsoDate(repo.pushedAt)}</span>
          <span className="rounded-md border border-border px-2 py-1">Created: {formatIsoDate(repo.repoCreatedAt)}</span>
          {repo.isArchived ? <span className="rounded-md border border-border px-2 py-1">Archived</span> : null}
          {repo.isFork ? <span className="rounded-md border border-border px-2 py-1">Fork</span> : null}
        </div>

        {repo.topics.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {repo.topics.map((t) => (
              <span key={t} className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
                {t}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-6">
          <RepoCommunityActions
            fullName={repo.fullName}
            initialBookmarked={isBookmarked}
            initialVoteScore={repo.stats.voteScore}
            isAuthenticated={Boolean(user)}
            repoId={repo.id}
          />
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">AI analysis</h2>
        {analysis ? (
          <div className="space-y-3 rounded-lg border border-border bg-background p-4">
            <div className="text-xs text-muted-foreground">
              Analyzed on {analysis.data.analysisDate} · model {analysis.data.modelVersion}
            </div>
            <p className="text-sm">{analysis.data.summary}</p>

            {analysis.data.highlights.length ? (
              <div>
                <div className="text-xs font-medium text-muted-foreground">Highlights</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {analysis.data.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {analysis.data.useCases.length ? (
              <div>
                <div className="text-xs font-medium text-muted-foreground">Use cases</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {analysis.data.useCases.map((u) => (
                    <li key={u}>{u}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {analysis.data.targetAudience ? (
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Target audience:</span> {analysis.data.targetAudience}
              </div>
            ) : null}

            {analysis.data.similarRepos.length ? (
              <div>
                <div className="text-xs font-medium text-muted-foreground">Similar projects</div>
                <ul className="mt-2 space-y-1 text-sm">
                  {analysis.data.similarRepos.slice(0, 8).map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3">
                      <Link
                        className="truncate text-muted-foreground hover:text-foreground hover:underline"
                        href={`/repositories/${s.fullName
                          .split("/")
                          .map((p) => encodeURIComponent(p))
                          .join("/")}`}
                      >
                        {s.fullName}
                      </Link>
                      <span className="shrink-0 text-xs text-muted-foreground">{Math.round(s.similarity * 100)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : repo.analysis ? (
          <div className="space-y-2 rounded-lg border border-border bg-background p-4">
            <div className="text-xs text-muted-foreground">Analyzed on {repo.analysis.analysisDate}</div>
            <p className="text-sm">{repo.analysis.summary}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No AI analysis yet. It will appear after the daily AI job runs.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">History (last 30 days)</h2>
        {repo.history.length ? (
          <div className="overflow-x-auto rounded-lg border border-border bg-background">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Stars</th>
                  <th className="px-4 py-3">Forks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {repo.history.map((h) => (
                  <tr key={h.date}>
                    <td className="px-4 py-3">{formatIsoDate(`${h.date}T00:00:00Z`)}</td>
                    <td className="px-4 py-3">{formatCompactNumber(h.stars)}</td>
                    <td className="px-4 py-3">{formatCompactNumber(h.forks)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">History will appear after the daily collector runs.</p>
        )}
      </section>

      <RepoComments
        currentUserId={user?.id ?? null}
        fullName={repo.fullName}
        initial={comments}
        isAuthenticated={Boolean(user)}
      />

      <script
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        type="application/ld+json"
      />
      <script
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        type="application/ld+json"
      />
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
      {sub ? <div className="text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

