import type { MetadataRoute } from "next";
import { getApiBaseUrl, getAppUrl } from "../lib/env";
import type { DeveloperListResponse, RepoListResponse } from "../lib/types";

function appBase(): string {
  return getAppUrl().replace(/\/$/, "");
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = appBase();
  const api = getApiBaseUrl().replace(/\/$/, "");

  const [repos, devs] = await Promise.all([
    fetch(`${api}/repositories?limit=1000`, { next: { revalidate: 3600 } })
      .then((r) => (r.ok ? (r.json() as Promise<RepoListResponse>) : null))
      .catch(() => null),
    fetch(`${api}/developers?limit=1000`, { next: { revalidate: 3600 } })
      .then((r) => (r.ok ? (r.json() as Promise<DeveloperListResponse>) : null))
      .catch(() => null),
  ]);

  const now = new Date();

  const staticUrls: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "hourly", priority: 1, lastModified: now },
    { url: `${base}/repositories`, changeFrequency: "hourly", priority: 0.9, lastModified: now },
    { url: `${base}/developers`, changeFrequency: "daily", priority: 0.8, lastModified: now },
    { url: `${base}/trends`, changeFrequency: "daily", priority: 0.7, lastModified: now },
    { url: `${base}/bookmarks`, changeFrequency: "weekly", priority: 0.5, lastModified: now },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2, lastModified: now },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.2, lastModified: now },
  ];

  const repoUrls: MetadataRoute.Sitemap =
    repos?.data.map((r) => ({
      url: `${base}/repositories/${r.fullName.split("/").map(encodeURIComponent).join("/")}`,
      changeFrequency: "daily",
      priority: 0.6,
      lastModified: r.pushedAt ? new Date(r.pushedAt) : now,
    })) ?? [];

  const devUrls: MetadataRoute.Sitemap =
    devs?.data.map((d) => ({
      url: `${base}/developers/${encodeURIComponent(d.login)}`,
      changeFrequency: "weekly",
      priority: 0.5,
      lastModified: now,
    })) ?? [];

  return [...staticUrls, ...repoUrls, ...devUrls];
}

