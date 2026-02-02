"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { apiDelete } from "../lib/api";
import type { BookmarkListResponse } from "../lib/types";
import { formatCompactNumber, formatIsoDate } from "../lib/format";

type BookmarkItem = BookmarkListResponse["data"][number];

export function BookmarkList({ initial }: { initial: BookmarkItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState<BookmarkItem[]>(initial);
  const [error, setError] = useState<string | null>(null);

  async function remove(repoId: number) {
    setError(null);
    try {
      await apiDelete(`/bookmarks/${repoId}`);
      setItems((prev) => prev.filter((b) => b.repository.id !== repoId));
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove bookmark");
    }
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-red-500">{error}</p> : null}

      {items.length ? (
        <div className="rounded-lg border border-border bg-background">
          <ul className="divide-y divide-border">
            {items.map((b) => (
              <li key={b.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <Link
                    className="truncate font-medium hover:underline"
                    href={`/repositories/${b.repository.fullName
                      .split("/")
                      .map((s) => encodeURIComponent(s))
                      .join("/")}`}
                  >
                    {b.repository.fullName}
                  </Link>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {formatCompactNumber(b.repository.stars)} ★ · bookmarked {formatIsoDate(b.createdAt)}
                  </div>

                  {b.note ? <p className="mt-2 whitespace-pre-wrap text-sm">{b.note}</p> : null}

                  {b.tags.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {b.tags.map((t) => (
                        <span key={t} className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <button
                  className="self-start rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
                  disabled={isPending}
                  type="button"
                  onClick={() => remove(b.repository.id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No bookmarks yet.</p>
      )}
    </div>
  );
}

