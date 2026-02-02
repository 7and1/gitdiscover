import Link from "next/link";
import Image from "next/image";
import { GitFork, Star, TrendingUp } from "lucide-react";
import type { RepoListItem } from "../lib/types";
import { formatCompactNumber, formatIsoDate } from "../lib/format";

export function RepoCard({ repo }: { repo: RepoListItem }) {
  const href = `/repositories/${repo.fullName
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/")}`;

  return (
    <article className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold">
            <Link className="hover:underline" href={href}>
              {repo.fullName}
            </Link>
          </h3>
          {repo.description ? (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{repo.description}</p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">No description.</p>
          )}
        </div>

        {repo.owner.avatarUrl ? (
          <Image
            alt={`${repo.owner.login} avatar`}
            className="h-10 w-10 shrink-0 rounded-full border border-border"
            src={repo.owner.avatarUrl}
            width={40}
            height={40}
          />
        ) : (
          <div className="h-10 w-10 shrink-0 rounded-full border border-border bg-muted" />
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {repo.language ? (
          <span className="rounded-md bg-muted px-2 py-1 text-foreground">{repo.language}</span>
        ) : null}

        <span className="inline-flex items-center gap-1">
          <Star className="h-4 w-4" aria-hidden="true" />
          {formatCompactNumber(repo.stars)}{" "}
          <span className="text-muted-foreground">(+{formatCompactNumber(repo.starsGrowth24h)} 24h)</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <GitFork className="h-4 w-4" aria-hidden="true" />
          {formatCompactNumber(repo.forks)}{" "}
          <span className="text-muted-foreground">(+{formatCompactNumber(repo.forksGrowth24h)} 24h)</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <TrendingUp className="h-4 w-4" aria-hidden="true" />
          score {repo.score.toFixed(1)}
        </span>

        <span>pushed {formatIsoDate(repo.pushedAt)}</span>
      </div>

      {repo.topics.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {repo.topics.slice(0, 6).map((t) => (
            <span key={t} className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
              {t}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

