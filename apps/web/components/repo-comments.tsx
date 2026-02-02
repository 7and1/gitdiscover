"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { apiDelete, apiPost, apiPut } from "../lib/api";
import type { CommentListResponse, CreateCommentResponse, UpdateCommentResponse } from "../lib/types";
import { formatIsoDate } from "../lib/format";

type CommentItem = CommentListResponse["data"][number];

export function RepoComments({
  fullName,
  initial,
  isAuthenticated,
  currentUserId,
}: {
  fullName: string;
  initial: CommentListResponse;
  isAuthenticated: boolean;
  currentUserId: number | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState<CommentItem[]>(initial.data);
  const [newContent, setNewContent] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  const encoded = useMemo(() => encodeURIComponent(fullName), [fullName]);

  async function submitNew() {
    if (!isAuthenticated) {
      setError("Sign in to comment.");
      return;
    }
    const content = newContent.trim();
    if (!content) return;
    setError(null);

    try {
      const res = await apiPost<CreateCommentResponse>(`/repositories/${encoded}/comments`, { content });
      const next: CommentItem = {
        id: res.data.id,
        content: res.data.content,
        user: res.data.user,
        replies: [],
        createdAt: res.data.createdAt,
        isEdited: res.data.isEdited,
      };
      setItems((prev) => [next, ...prev]);
      setNewContent("");
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Comment failed");
    }
  }

  async function startEdit(c: CommentItem) {
    setEditingId(c.id);
    setEditingContent(c.content);
    setError(null);
  }

  async function saveEdit(id: number) {
    if (!isAuthenticated) {
      setError("Sign in to edit comments.");
      return;
    }
    const content = editingContent.trim();
    if (!content) return;
    setError(null);

    try {
      const res = await apiPut<UpdateCommentResponse>(`/comments/${id}`, { content });
      setItems((prev) =>
        prev.map((c) => (c.id === id ? { ...c, content: res.data.content, isEdited: res.data.isEdited } : c))
      );
      setEditingId(null);
      setEditingContent("");
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Edit failed");
    }
  }

  async function deleteComment(id: number) {
    if (!isAuthenticated) {
      setError("Sign in to delete comments.");
      return;
    }
    setError(null);
    try {
      await apiDelete(`/comments/${id}`);
      setItems((prev) => prev.filter((c) => c.id !== id));
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Comments</h2>

      <div className="rounded-lg border border-border bg-background p-4">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="new-comment">
          Add a comment
        </label>
        <textarea
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
          id="new-comment"
          placeholder={isAuthenticated ? "Share your thoughts…" : "Sign in to comment"}
          rows={4}
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">{newContent.trim().length}/5000</div>
          <button
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
            disabled={isPending || newContent.trim().length === 0}
            type="button"
            onClick={submitNew}
          >
            Post
          </button>
        </div>
        {error ? <p className="mt-2 text-sm text-red-500">{error}</p> : null}
      </div>

      {items.length ? (
        <div className="space-y-3">
          {items.map((c) => {
            const isOwner = currentUserId !== null && c.user.id === currentUserId;
            return (
              <article key={c.id} className="rounded-lg border border-border bg-background p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {c.user.avatarUrl ? (
                      <Image
                        alt={`${c.user.login} avatar`}
                        className="h-8 w-8 rounded-full border border-border"
                        src={c.user.avatarUrl}
                        width={32}
                        height={32}
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full border border-border bg-muted" />
                    )}
                    <div>
                      <div className="text-sm font-medium">@{c.user.login}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatIsoDate(c.createdAt)} {c.isEdited ? "· edited" : ""}
                      </div>
                    </div>
                  </div>

                  {isOwner ? (
                    <div className="flex items-center gap-2 text-sm">
                      <button
                        className="rounded-md border border-border bg-background px-2 py-1 hover:bg-muted disabled:opacity-50"
                        disabled={isPending}
                        type="button"
                        onClick={() => startEdit(c)}
                      >
                        Edit
                      </button>
                      <button
                        className="rounded-md border border-border bg-background px-2 py-1 hover:bg-muted disabled:opacity-50"
                        disabled={isPending}
                        type="button"
                        onClick={() => deleteComment(c.id)}
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>

                {editingId === c.id ? (
                  <div className="mt-3 space-y-2">
                    <textarea
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
                      rows={4}
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        className="rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
                        disabled={isPending}
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditingContent("");
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
                        disabled={isPending || editingContent.trim().length === 0}
                        type="button"
                        onClick={() => saveEdit(c.id)}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 whitespace-pre-wrap text-sm">{c.content}</p>
                )}

                {c.replies.length ? (
                  <div className="mt-4 space-y-2 border-l border-border pl-4">
                    {c.replies.map((r) => (
                      <div key={r.id} className="space-y-1">
                        <div className="text-xs text-muted-foreground">
                          @{r.user.login} · {formatIsoDate(r.createdAt)}
                        </div>
                        <div className="text-sm">{r.content}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No comments yet. Be the first to leave one.</p>
      )}
    </section>
  );
}

