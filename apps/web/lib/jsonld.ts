import { getAppUrl } from "./env";

export interface BreadcrumbItem {
  name: string;
  item: string;
}

export function generateBreadcrumbSchema(items: BreadcrumbItem[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.item,
    })),
  };
}

export function generateWebSiteSchema(): Record<string, unknown> {
  const baseUrl = getAppUrl();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "GitDiscover",
    url: baseUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${baseUrl}/repositories?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function generateOrganizationSchema(): Record<string, unknown> {
  const baseUrl = getAppUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "GitDiscover",
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
    sameAs: [
      "https://github.com/gitdiscover",
      "https://twitter.com/gitdiscover",
    ],
  };
}

export function generateSoftwareSourceCodeSchema(repo: {
  name: string;
  fullName: string;
  description?: string | null;
  language?: string | null;
  license?: string | null;
  owner?: { login: string } | null;
  stars?: number;
  forks?: number;
}): Record<string, unknown> {
  return {
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
    aggregateRating: repo.stars
      ? {
          "@type": "AggregateRating",
          ratingValue: "5",
          ratingCount: repo.stars,
        }
      : undefined,
  };
}

export function generatePersonSchema(dev: {
  login: string;
  name?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  blog?: string | null;
  twitterUsername?: string | null;
  followers?: number;
}): Record<string, unknown> {
  const sameAs: string[] = [`https://github.com/${dev.login}`];
  if (dev.blog) sameAs.push(dev.blog);
  if (dev.twitterUsername) sameAs.push(`https://twitter.com/${dev.twitterUsername}`);

  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: dev.name ?? dev.login,
    alternateName: dev.login,
    description: dev.bio ?? undefined,
    url: `https://github.com/${dev.login}`,
    image: dev.avatarUrl ?? undefined,
    sameAs,
  };
}
