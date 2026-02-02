import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "../components/theme-provider";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { getCurrentUser } from "../lib/server-auth";
import { getAppUrl } from "../lib/env";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(getAppUrl()),
  title: {
    default: "GitDiscover — Discover trending GitHub projects",
    template: "%s | GitDiscover",
  },
  description:
    "GitDiscover surfaces trending GitHub repositories and developers daily, with community curation and AI-powered insights.",
  keywords: [
    "GitHub",
    "trending repositories",
    "open source",
    "developers",
    "code discovery",
    "AI insights",
    "programming",
    "software",
  ],
  authors: [{ name: "GitDiscover" }],
  creator: "GitDiscover",
  publisher: "GitDiscover",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    siteName: "GitDiscover",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@gitdiscover",
    creator: "@gitdiscover",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser().catch(() => null);
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <SiteHeader user={user ? { login: user.login } : null} />
          <main className="mx-auto min-h-[calc(100vh-3.5rem)] max-w-6xl px-4 py-8">
            {children}
          </main>
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
