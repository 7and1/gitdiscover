import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { getApiOrigin } from "../lib/env";
import { LogoutButton } from "./user-actions";

export function SiteHeader({ user }: { user: { login: string } | null }) {
  const apiOrigin = getApiOrigin();

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold tracking-tight">
            GitDiscover
          </Link>
          <nav className="hidden items-center gap-4 text-sm text-muted-foreground sm:flex">
            <Link href="/repositories" className="hover:text-foreground">
              Repositories
            </Link>
            <Link href="/developers" className="hover:text-foreground">
              Developers
            </Link>
            <Link href="/trends" className="hover:text-foreground">
              Trends
            </Link>
            <Link href="/bookmarks" className="hover:text-foreground">
              Bookmarks
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />

          {user ? (
            <div className="flex items-center gap-2">
              <span className="hidden text-sm text-muted-foreground sm:inline">@{user.login}</span>
              <LogoutButton apiOrigin={apiOrigin} />
            </div>
          ) : (
            <a
              className="inline-flex items-center rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90"
              href={`${apiOrigin}/auth/github`}
            >
              Sign in with GitHub
            </a>
          )}
        </div>
      </div>
    </header>
  );
}

