export interface RepoMetrics {
  starsGrowth24h: number;
  forksGrowth24h: number;
  hasReadme: boolean;
  hasLicense: boolean;
  lastCommitDays: number;
  openIssueRatio: number; // open / total
}

export function calculateHotnessScore(metrics: RepoMetrics): number {
  const baseScore = metrics.starsGrowth24h * 0.7 + metrics.forksGrowth24h * 0.3;

  let multiplier = 1.0;
  if (metrics.hasReadme) multiplier += 0.1;
  if (metrics.hasLicense) multiplier += 0.05;
  if (metrics.lastCommitDays < 30) multiplier += 0.15;
  if (metrics.openIssueRatio < 0.3) multiplier += 0.1;

  return Math.round(baseScore * multiplier * 100) / 100;
}

export interface DeveloperMetrics {
  followers: number;
  activeRepos: number; // repos with recent activity
  totalStars: number; // sum of all repo stars
  contributions: number; // last year contributions
}

export function calculateImpactScore(metrics: DeveloperMetrics): number {
  const followerScore = Math.log10(metrics.followers + 1);
  const repoScore = metrics.activeRepos * 0.5;
  const starBonus = Math.log10(metrics.totalStars + 1) * 0.3;
  const activityBonus = Math.min(metrics.contributions / 1000, 1) * 0.2;

  return Math.round((followerScore + repoScore + starBonus + activityBonus) * 100) / 100;
}

