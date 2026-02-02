"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrendsLanguagesResponse } from "../lib/types";

export function LanguageTrendsChart({ data }: { data: TrendsLanguagesResponse["data"] }) {
  const top = data.slice(0, 10).map((d) => ({
    language: d.language,
    stars: d.stars,
    growth: d.growth,
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={top} margin={{ left: 8, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="language" tick={{ fontSize: 12 }} interval={0} angle={-25} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="stars" fill="currentColor" opacity={0.75} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

