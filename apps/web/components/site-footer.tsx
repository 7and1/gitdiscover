import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border py-10">
      <div className="mx-auto max-w-6xl px-4 text-sm text-muted-foreground">
        <div>GitDiscover — Product Hunt for GitHub.</div>
        <div className="mt-2">Built with Next.js, Fastify, PostgreSQL, Redis, and Cloudflare-ready caching.</div>
        <div className="mt-4 flex flex-wrap gap-4">
          <Link className="hover:text-foreground hover:underline" href="/privacy">
            Privacy
          </Link>
          <Link className="hover:text-foreground hover:underline" href="/terms">
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}
