import type { MetadataRoute } from "next";
import { getAppUrl } from "../lib/env";

export default function robots(): MetadataRoute.Robots {
  const base = getAppUrl().replace(/\/$/, "");
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${base}/sitemap.xml`,
  };
}

