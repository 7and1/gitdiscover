import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "GitDiscover — Discover trending GitHub projects";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 64,
          background: "linear-gradient(135deg, #0a0a0a, #111827)",
          color: "white",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
        }}
      >
        <div style={{ fontSize: 56, fontWeight: 700, letterSpacing: -1 }}>GitDiscover</div>
        <div style={{ marginTop: 16, fontSize: 28, opacity: 0.9 }}>
          Discover trending GitHub repositories and developers — daily.
        </div>
        <div style={{ marginTop: 28, fontSize: 18, opacity: 0.75 }}>
          Community curation + AI insights + trend analytics
        </div>
      </div>
    ),
    size
  );
}

