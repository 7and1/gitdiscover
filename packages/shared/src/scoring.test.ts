import { describe, expect, it } from "vitest";
import { calculateHotnessScore, calculateImpactScore } from "./scoring";

describe("calculateHotnessScore", () => {
  it("applies README/LICENSE/activity/issue multipliers", () => {
    const score = calculateHotnessScore({
      starsGrowth24h: 100,
      forksGrowth24h: 20,
      hasReadme: true,
      hasLicense: true,
      lastCommitDays: 10,
      openIssueRatio: 0.2,
    });

    // base = 100*0.7 + 20*0.3 = 76
    // multiplier = 1 + 0.1 + 0.05 + 0.15 + 0.1 = 1.4
    // final = 106.4
    expect(score).toBe(106.4);
  });

  it("rounds to 2 decimals", () => {
    const score = calculateHotnessScore({
      starsGrowth24h: 1,
      forksGrowth24h: 1,
      hasReadme: false,
      hasLicense: false,
      lastCommitDays: 365,
      openIssueRatio: 1,
    });
    expect(score).toBe(1);
  });
});

describe("calculateImpactScore", () => {
  it("matches the documented formula and rounds to 2 decimals", () => {
    const score = calculateImpactScore({
      followers: 999,
      activeRepos: 4,
      totalStars: 10_000,
      contributions: 500,
    });

    const followerScore = Math.log10(1000);
    const repoScore = 4 * 0.5;
    const starBonus = Math.log10(10_001) * 0.3;
    const activityBonus = Math.min(500 / 1000, 1) * 0.2;
    const expected = Math.round((followerScore + repoScore + starBonus + activityBonus) * 100) / 100;

    expect(score).toBe(expected);
  });
});

