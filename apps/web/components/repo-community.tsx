"use client";

import { Bookmark, ThumbsDown, ThumbsUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { apiDelete, apiPost } from "../lib/api";
import type { VoteResponse } from "../lib/types";

export function RepoCommunityActions({
  repoId,
  fullName,
  isAuthenticated,
  initialBookmarked,
  initialVoteScore,
}: {
  repoId: number;
  fullName: string;
  isAuthenticated: boolean;
  initialBookmarked: boolean;
  initialVoteScore: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [voteScore, setVoteScore] = useState(initialVoteScore);
  const [error, setError] = useState<string | null>(null);

  async function toggleBookmark() {
    if (!isAuthenticated) {
      setError("Sign in to bookmark repositories.");
      return;
    }
    setError(null);

    try {
      if (bookmarked) {
        await apiDelete(`/bookmarks/${repoId}`);
        setBookmarked(false);
      } else {
        await apiPost(`/bookmarks`, { repositoryId: repoId });
        setBookmarked(true);
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bookmark failed");
    }
  }

  async function vote(value: 1 | -1) {
    if (!isAuthenticated) {
      setError("Sign in to vote.");
      return;
    }
    setError(null);
    try {
      const encoded = encodeURIComponent(fullName);
      const res = await apiPost<VoteResponse>(`/repositories/${encoded}/vote`, { value });
      setVoteScore(res.data.totalScore);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Vote failed");
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
          disabled={isPending}
          type="button"
          onClick={() => vote(1)}
        >
          <ThumbsUp className="h-4 w-4" aria-hidden="true" />
          Upvote
        </button>
        <button
          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
          disabled={isPending}
          type="button"
          onClick={() => vote(-1)}
        >
          <ThumbsDown className="h-4 w-4" aria-hidden="true" />
          Downvote
        </button>

        <button
          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
          disabled={isPending}
          type="button"
          onClick={toggleBookmark}
        >
          <Bookmark className="h-4 w-4" aria-hidden="true" />
          {bookmarked ? "Bookmarked" : "Bookmark"}
        </button>

        <div className="text-sm text-muted-foreground">Vote score: {voteScore}</div>
      </div>

      {error ? <p className="text-sm text-red-500">{error}</p> : null}
    </div>
  );
}

