import Link from "next/link";
import { Star, TrendingUp } from "lucide-react";
import type { RepoSearchResponse } from "../lib/types";
import { formatCompactNumber } from "../lib/format";

type RepoSearchItem = RepoSearchResponse["data"][number];

export function RepoSearchCard({ repo }: { repo: RepoSearchItem }) {
  return (
    <article className="rounded-lg border border-border bg-background p-4">
      <h3 className="truncate text-base font-semibold">
        <Link
          className="hover:underline"
          href={`/repositories/${repo.fullName
            .split("/")
            .map((s) => encodeURIComponent(s))
            .join("/")}`}
        >
          {repo.fullName}
        </Link>
      </h3>

      {repo.description ? (
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{repo.description}</p>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">No description.</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {repo.language ? (
          <span className="rounded-md bg-muted px-2 py-1 text-foreground">{repo.language}</span>
        ) : null}
        <span className="inline-flex items-center gap-1">
          <Star className="h-4 w-4" aria-hidden="true" />
          {formatCompactNumber(repo.stars)}
        </span>
        <span className="inline-flex items-center gap-1">
          <TrendingUp className="h-4 w-4" aria-hidden="true" />
          score {repo.score.toFixed(1)}
        </span>
      </div>
    </article>
  );
}

