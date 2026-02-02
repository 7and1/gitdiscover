import Link from "next/link";
import Image from "next/image";
import { Star, Users } from "lucide-react";
import type { DeveloperListItem } from "../lib/types";
import { formatCompactNumber } from "../lib/format";

export function DeveloperCard({ dev }: { dev: DeveloperListItem }) {
  return (
    <article className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-start gap-3">
        {dev.avatarUrl ? (
          <Image
            alt={`${dev.login} avatar`}
            className="h-10 w-10 shrink-0 rounded-full border border-border"
            src={dev.avatarUrl}
            width={40}
            height={40}
          />
        ) : (
          <div className="h-10 w-10 shrink-0 rounded-full border border-border bg-muted" />
        )}

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold">
            <Link className="hover:underline" href={`/developers/${encodeURIComponent(dev.login)}`}>
              {dev.name ? `${dev.name} (@${dev.login})` : `@${dev.login}`}
            </Link>
          </h3>
          {dev.bio ? (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{dev.bio}</p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">No bio.</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Users className="h-4 w-4" aria-hidden="true" />
          {formatCompactNumber(dev.followers)} followers
        </span>
        <span className="inline-flex items-center gap-1">
          <Star className="h-4 w-4" aria-hidden="true" />
          {formatCompactNumber(dev.totalStars)} stars
        </span>
        <span className="rounded-md bg-muted px-2 py-1 text-foreground">impact {dev.impactScore.toFixed(2)}</span>
      </div>

      {dev.topRepos.length ? (
        <div className="mt-3 space-y-1 text-sm">
          <div className="text-xs font-medium text-muted-foreground">Top repos</div>
          <ul className="space-y-1">
            {dev.topRepos.slice(0, 3).map((r) => (
              <li key={r.fullName} className="flex items-center justify-between gap-3">
                <Link
                  className="truncate text-muted-foreground hover:text-foreground hover:underline"
                  href={`/repositories/${r.fullName
                    .split("/")
                    .map((s) => encodeURIComponent(s))
                    .join("/")}`}
                >
                  {r.fullName}
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground">{formatCompactNumber(r.stars)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

