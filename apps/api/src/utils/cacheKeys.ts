export function repoListCacheKey(params: {
  language?: string | undefined;
  sort: string;
  period: string;
  limit: number;
}): string {
  const language = params.language ?? "all";
  return `cache:v1:repos:list:${language}:${params.sort}:${params.period}:limit:${params.limit}`;
}

export function repoDetailCacheKey(fullName: string): string {
  return `cache:v1:repos:detail:${fullName}`;
}

export function repoAnalysisCacheKey(fullName: string): string {
  return `cache:v1:repos:analysis:${fullName}`;
}

export function developerListCacheKey(params: { sort: string; limit: number }): string {
  return `cache:v1:devs:list:${params.sort}:limit:${params.limit}`;
}

export function languageTrendsCacheKey(period: string): string {
  return `cache:v1:trends:languages:${period}`;
}

export function topicTrendsCacheKey(period: string): string {
  return `cache:v1:trends:topics:${period}`;
}

export function growthTrendsCacheKey(params: { metric: string; period: string; limit: number }): string {
  return `cache:v1:trends:growth:${params.metric}:${params.period}:limit:${params.limit}`;
}
