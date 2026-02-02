import type { Metadata } from "next";
import { getApiOrigin, getAppUrl } from "../../lib/env";
import { apiGetServer } from "../../lib/server-api";
import { getCurrentUser } from "../../lib/server-auth";
import type { BookmarkListResponse } from "../../lib/types";
import { BookmarkList } from "../../components/bookmark-list";

export const metadata: Metadata = {
  title: "Bookmarks",
  description: "Your saved repositories.",
  alternates: { canonical: `${getAppUrl()}/bookmarks` },
};

export default async function BookmarksPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    const apiOrigin = getApiOrigin();
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Bookmarks</h1>
        <p className="text-sm text-muted-foreground">Sign in to save and manage bookmarks.</p>
        <a
          className="inline-flex items-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
          href={`${apiOrigin}/auth/github`}
        >
          Sign in with GitHub
        </a>
      </div>
    );
  }

  const bookmarks = await apiGetServer<BookmarkListResponse>("/bookmarks", { cache: "no-store" });

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Bookmarks</h1>
        <p className="text-sm text-muted-foreground">Saved repositories for @{user.login}.</p>
      </header>

      <BookmarkList initial={bookmarks.data} />
    </div>
  );
}

