import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms for using GitDiscover.",
  alternates: { canonical: "/terms" },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="text-sm text-muted-foreground">Last updated: 2026-02-01</p>

      <div className="space-y-4 text-sm">
        <p>
          GitDiscover provides discovery and analysis of public GitHub repositories. By using the site, you agree to
          these terms.
        </p>

        <h2 className="text-lg font-semibold">Acceptable Use</h2>
        <ul className="list-disc pl-5">
          <li>Do not abuse the API or attempt to bypass rate limits.</li>
          <li>Do not post spam, harassment, or illegal content in comments.</li>
          <li>Do not attempt to access other users’ sessions or private data.</li>
        </ul>

        <h2 className="text-lg font-semibold">Content Disclaimer</h2>
        <p>
          Repository data is sourced from GitHub and may be incomplete or outdated. AI analysis is generated
          automatically and may contain errors; verify details before making technical decisions.
        </p>

        <h2 className="text-lg font-semibold">Service Availability</h2>
        <p>
          The service is provided “as is” without warranties. We may change or discontinue features at any time.
        </p>
      </div>
    </div>
  );
}

