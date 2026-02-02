import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { apiGetServer } from "../../../lib/server-api";
import type { DeveloperDetailResponse } from "../../../lib/types";
import { formatCompactNumber, formatIsoDate } from "../../../lib/format";
import { getAppUrl } from "../../../lib/env";
import { generateBreadcrumbSchema } from "../../../lib/jsonld";

export async function generateMetadata({
  params,
}: {
  params: { login: string };
}): Promise<Metadata> {
  const login = decodeURIComponent(params.login);
  const baseUrl = getAppUrl();
  const dev = await apiGetServer<DeveloperDetailResponse>(`/developers/${encodeURIComponent(login)}`, {
    next: { revalidate: 3600 },
  }).catch(() => null);

  const title = dev?.data.name ? `${dev.data.name} (@${dev.data.login})` : `@${login}`;
  const description = dev?.data.bio
    ? dev.data.bio
    : "Developer profile with top repositories, impact score, and recent trend history.";
  const canonicalPath = `/developers/${encodeURIComponent(login)}`;

  return {
    title,
    description,
    alternates: { canonical: `${baseUrl}${canonicalPath}` },
    openGraph: {
      title,
      description,
      type: "profile",
      url: `${baseUrl}${canonicalPath}`,
      images: dev?.data.avatarUrl
        ? [
            {
              url: dev.data.avatarUrl,
              width: 120,
              height: 120,
              alt: `${dev.data.login} profile picture`,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: dev?.data.avatarUrl ? [dev.data.avatarUrl] : undefined,
    },
  };
}

export default async function DeveloperDetailPage({ params }: { params: { login: string } }) {
  const login = decodeURIComponent(params.login);
  const res = await apiGetServer<DeveloperDetailResponse>(`/developers/${encodeURIComponent(login)}`, {
    cache: "no-store",
  });
  const dev = res.data;

  const baseUrl = getAppUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: dev.name ?? dev.login,
    alternateName: dev.login,
    description: dev.bio ?? undefined,
    url: `https://github.com/${dev.login}`,
    image: dev.avatarUrl ?? undefined,
    sameAs: [
      `https://github.com/${dev.login}`,
      dev.blog ?? undefined,
      dev.twitterUsername ? `https://twitter.com/${dev.twitterUsername}` : undefined,
    ].filter(Boolean),
  };

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: "Home", item: baseUrl },
    { name: "Developers", item: `${baseUrl}/developers` },
    { name: `@${dev.login}`, item: `${baseUrl}/developers/${encodeURIComponent(dev.login)}` },
  ]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 rounded-lg border border-border bg-background p-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          {dev.avatarUrl ? (
            <Image
              alt={`${dev.login} avatar`}
              className="h-16 w-16 rounded-full border border-border"
              src={dev.avatarUrl}
              width={64}
              height={64}
              priority
            />
          ) : (
            <div className="h-16 w-16 rounded-full border border-border bg-muted" />
          )}

          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {dev.name ? `${dev.name} ` : ""}
              <span className="text-muted-foreground">@{dev.login}</span>
            </h1>
            {dev.bio ? <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{dev.bio}</p> : null}

            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <a className="hover:text-foreground hover:underline" href={`https://github.com/${dev.login}`}>
                GitHub profile
              </a>
              {dev.blog ? (
                <a className="hover:text-foreground hover:underline" href={dev.blog} rel="noreferrer" target="_blank">
                  Website
                </a>
              ) : null}
              {dev.twitterUsername ? (
                <a
                  className="hover:text-foreground hover:underline"
                  href={`https://twitter.com/${dev.twitterUsername}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  Twitter
                </a>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-md border border-border bg-background p-3">
            <div className="text-xs text-muted-foreground">Followers</div>
            <div className="font-semibold">{formatCompactNumber(dev.followers)}</div>
          </div>
          <div className="rounded-md border border-border bg-background p-3">
            <div className="text-xs text-muted-foreground">Total stars</div>
            <div className="font-semibold">{formatCompactNumber(dev.totalStars)}</div>
          </div>
          <div className="rounded-md border border-border bg-background p-3">
            <div className="text-xs text-muted-foreground">Impact score</div>
            <div className="font-semibold">{dev.impactScore.toFixed(2)}</div>
          </div>
          <div className="rounded-md border border-border bg-background p-3">
            <div className="text-xs text-muted-foreground">Public repos</div>
            <div className="font-semibold">{formatCompactNumber(dev.publicRepos)}</div>
          </div>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Top repositories</h2>
        {dev.repositories.length ? (
          <div className="rounded-lg border border-border bg-background">
            <ul className="divide-y divide-border">
              {dev.repositories.slice(0, 30).map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <Link
                      className="truncate font-medium hover:underline"
                      href={`/repositories/${r.fullName
                        .split("/")
                        .map((s) => encodeURIComponent(s))
                        .join("/")}`}
                    >
                      {r.fullName}
                    </Link>
                    <div className="mt-1 text-xs text-muted-foreground">{r.language ?? "Unknown language"}</div>
                  </div>
                  <div className="shrink-0 text-sm text-muted-foreground">{formatCompactNumber(r.stars)} ★</div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No repositories found yet.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recent history</h2>
        {dev.history.length ? (
          <div className="overflow-x-auto rounded-lg border border-border bg-background">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Followers</th>
                  <th className="px-4 py-3">Total stars</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {dev.history.map((h) => (
                  <tr key={h.date}>
                    <td className="px-4 py-3">{formatIsoDate(`${h.date}T00:00:00Z`)}</td>
                    <td className="px-4 py-3">{formatCompactNumber(h.followers)}</td>
                    <td className="px-4 py-3">{formatCompactNumber(h.totalStars)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">History will appear after the daily collector runs.</p>
        )}
      </section>

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

