export type Role = "USER" | "MODERATOR" | "ADMIN";

export type RepoListItem = {
  id: number;
  githubId: number;
  fullName: string;
  name: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  starsGrowth24h: number;
  forksGrowth24h: number;
  score: number;
  topics: string[];
  owner: { login: string; avatarUrl: string | null };
  pushedAt: string | null;
};

export type RepoListResponse = {
  data: RepoListItem[];
  cursor: string | null;
  hasMore: boolean;
};

export type RepoDetail = {
  id: number;
  githubId: number;
  fullName: string;
  name: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  starsGrowth24h: number;
  forksGrowth24h: number;
  score: number;
  topics: string[];
  license: string | null;
  homepage: string | null;
  hasReadme: boolean;
  hasLicense: boolean;
  isArchived: boolean;
  isFork: boolean;
  owner:
    | {
        id: number;
        login: string;
        name: string | null;
        avatarUrl: string | null;
      }
    | null;
  analysis:
    | {
        summary: string;
        highlights: string[];
        useCases: string[];
        analysisDate: string;
      }
    | null;
  stats: { bookmarks: number; comments: number; voteScore: number };
  history: Array<{ date: string; stars: number; forks: number }>;
  pushedAt: string | null;
  repoCreatedAt: string | null;
};

export type RepoDetailResponse = { data: RepoDetail };

export type RepoSearchResponse = {
  data: Array<{
    id: number;
    fullName: string;
    name: string;
    description: string | null;
    language: string | null;
    stars: number;
    score: number;
    relevance: number;
  }>;
  total: number;
  query: string;
};

export type DeveloperListItem = {
  id: number;
  githubId: number;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  bio: string | null;
  followers: number;
  publicRepos: number;
  totalStars: number;
  impactScore: number;
  topRepos: Array<{ fullName: string; stars: number }>;
};

export type DeveloperListResponse = {
  data: DeveloperListItem[];
  cursor: string | null;
  hasMore: boolean;
};

export type DeveloperDetailResponse = {
  data: {
    id: number;
    githubId: number;
    login: string;
    name: string | null;
    avatarUrl: string | null;
    bio: string | null;
    company: string | null;
    location: string | null;
    blog: string | null;
    twitterUsername: string | null;
    followers: number;
    following: number;
    publicRepos: number;
    totalStars: number;
    impactScore: number;
    contributions: number;
    repositories: Array<{ id: number; fullName: string; stars: number; language: string | null }>;
    history: Array<{ date: string; followers: number; totalStars: number }>;
    devCreatedAt: string | null;
  };
};

export type UserResponse = {
  data: {
    id: number;
    githubId: number;
    login: string;
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
    role: Role;
    stats: { bookmarks: number; comments: number; votes: number };
    createdAt: string;
  };
};

export type CommentListResponse = {
  data: Array<{
    id: number;
    content: string;
    user: { id: number; login: string; avatarUrl: string | null };
    replies: Array<{ id: number; content: string; user: { login: string; avatarUrl: string | null }; createdAt: string }>;
    createdAt: string;
    isEdited: boolean;
  }>;
  cursor: string | null;
  hasMore: boolean;
};

export type BookmarkListResponse = {
  data: Array<{
    id: number;
    repository: { id: number; fullName: string; stars: number };
    note: string | null;
    tags: string[];
    createdAt: string;
  }>;
};

export type TrendsLanguagesResponse = {
  data: Array<{ language: string; repos: number; stars: number; growth: number; trend: string }>;
  period: string;
  generatedAt: string;
};

export type TrendsTopicsResponse = {
  data: Array<{ topic: string; repos: number; growth: number; relatedTopics: string[] }>;
  period: string;
};

export type TrendsGrowthResponse = {
  data: Array<{
    rank: number;
    repository: { id: number; fullName: string; language: string | null };
    growth: number;
    growthPercent: number;
    previousValue: number;
    currentValue: number;
  }>;
  metric: string;
  period: string;
};

export type RepoAnalysisResponse = {
  data: {
    repositoryId: number;
    analysisDate: string;
    summary: string;
    highlights: string[];
    useCases: string[];
    techStack: unknown;
    codeQuality: unknown;
    similarRepos: Array<{ id: number; fullName: string; similarity: number }>;
    targetAudience: string | null;
    modelVersion: string;
  };
};

export type VoteResponse = {
  data: { repositoryId: number; userVote: 1 | -1; totalScore: number };
};

export type CreateCommentResponse = {
  data: {
    id: number;
    content: string;
    user: { id: number; login: string; avatarUrl: string | null };
    createdAt: string;
    isEdited: boolean;
  };
};

export type UpdateCommentResponse = {
  data: {
    id: number;
    content: string;
    isEdited: boolean;
    updatedAt: string;
  };
};

