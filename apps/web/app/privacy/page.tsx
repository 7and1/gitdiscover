import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How GitDiscover handles data and cookies.",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">Last updated: 2026-02-01</p>

      <div className="space-y-4 text-sm">
        <p>
          GitDiscover displays public information about GitHub repositories and developers. We do not sell personal data.
        </p>

        <h2 className="text-lg font-semibold">Data We Collect</h2>
        <ul className="list-disc pl-5">
          <li>Public GitHub profile data (login, avatar, bio) used to render developer and repository pages.</li>
          <li>Usage events needed to operate the service (rate limiting, error logs).</li>
          <li>Authentication session cookie when you sign in with GitHub.</li>
        </ul>

        <h2 className="text-lg font-semibold">Cookies</h2>
        <p>
          We use an HTTP-only session cookie to keep you signed in. This cookie is required for bookmarks, comments, and
          voting. You can clear it by logging out.
        </p>

        <h2 className="text-lg font-semibold">Third-Party Services</h2>
        <ul className="list-disc pl-5">
          <li>GitHub OAuth for sign-in.</li>
          <li>GitHub API for public repository and developer metadata.</li>
          <li>OpenAI API (optional) to generate repository analysis for top projects.</li>
        </ul>

        <h2 className="text-lg font-semibold">Contact</h2>
        <p>If you have privacy questions, contact the site administrator.</p>
      </div>
    </div>
  );
}
