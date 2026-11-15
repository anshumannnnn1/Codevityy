export interface UserProfile {
  userId: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface GitHubConnectionState {
  configured: boolean;
  connected: boolean;
  githubUsername: string;
  avatarUrl: string;
  scopes: string;
  tokenRef: string;
  callbackUrl: string;
  sharedCallbackUrl?: string;
}

export interface GitHubRepoSummary {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  description: string;
  htmlUrl: string;
  isPrivate: boolean;
  defaultBranch: string;
  language: string;
  stargazersCount: number;
  forksCount: number;
  openIssuesCount: number;
  updatedAt: string;
  pushedAt: string;
}

export interface MetricScores {
  commitFrequency: number;
  codeQualityEstimate: number;
  collaboration: number;
  reviewParticipation: number;
  documentation: number;
}

export interface ScoreBreakdownItem {
  metric: keyof MetricScores;
  label: string;
  score: number;
  weight: number;
  weightedContribution: number;
  formulaExplanation: string;
  isProxyEstimate: boolean;
  dataStatus: 'sufficient' | 'limited' | 'insufficient';
}

export interface WeeklyCommitPoint {
  weekStart: string;
  label: string;
  commits: number;
}

export interface ContributorStat {
  login: string;
  avatarUrl: string;
  commits: number;
  sharePercent: number;
}

export interface PullRequestStats {
  open: number;
  merged: number;
  closedUnmerged: number;
  sampledForReviews: number;
  reviewedPullRequests: number;
  totalReviews: number;
  avgReviewCount: number;
  mergeRatePercent: number;
}

export interface AnalyticsSummary {
  totalCommits: number;
  totalContributors: number;
  totalPullRequests: number;
  mergedPullRequests: number;
  openPullRequests: number;
  closedUnmergedPullRequests: number;
  totalReviews: number;
  reviewedPullRequests: number;
  avgCommitMessageLength: number;
  descriptiveCommitRatio: number;
  hasReadme: boolean;
  readmeLength: number;
  hasDocsFolder: boolean;
  hasContributing: boolean;
  hasLicense: boolean;
  activeWeeks: number;
  totalWeeks: number;
  defaultBranch: string;
  primaryLanguage: string;
  stars: number;
  forks: number;
  weeklyCommits: WeeklyCommitPoint[];
  topContributors: ContributorStat[];
  prStats: PullRequestStats;
  dataWarnings: string[];
  scoreBreakdown: ScoreBreakdownItem[];
}

export interface AIInsights {
  available: boolean;
  provider: 'groq' | 'none';
  model: string;
  errorMessage: string;
  strengths: string[];
  improvementAreas: string[];
  recommendations: string[];
}

export interface AnalysisReport {
  id?: string;
  userId: string;
  repositoryName: string;
  repositoryOwner: string;
  repositoryUrl: string;
  isPrivate: boolean;
  analysisPeriodDays: number;
  analysisDate: string;
  productivityScore: number;
  consistencyScore: number;
  metricScores: MetricScores;
  analyticsSummary: AnalyticsSummary;
  aiInsights: AIInsights;
  createdAt: string;
}
