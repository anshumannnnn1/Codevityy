import type {
  AnalyticsSummary,
  ContributorStat,
  MetricScores,
  ScoreBreakdownItem,
  WeeklyCommitPoint,
} from '../src/types/codevity.ts';
import type {
  DocumentationSignals,
  RawCommitItem,
  RawContributorItem,
  RawPullRequestItem,
} from './githubService.ts';

interface AnalyticsInput {
  periodDays: number;
  defaultBranch: string;
  primaryLanguage: string;
  stars: number;
  forks: number;
  commits: RawCommitItem[];
  contributors: RawContributorItem[];
  pulls: RawPullRequestItem[];
  sampledForReviews: number;
  docs: DocumentationSignals;
}

const GENERIC_COMMIT_PATTERNS = [
  /^wip$/i,
  /^update$/i,
  /^fix$/i,
  /^changes?$/i,
  /^test$/i,
  /^commit$/i,
  /^asdf$/i,
  /^initial commit$/i,
  /^\.+$/,
];

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildWeeklyBuckets(commits: RawCommitItem[], periodDays: number): WeeklyCommitPoint[] {
  const totalWeeks = Math.max(2, Math.ceil(periodDays / 7));
  const now = Date.now();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const startWindowMs = now - totalWeeks * msPerWeek;

  const buckets: WeeklyCommitPoint[] = [];
  for (let i = 0; i < totalWeeks; i++) {
    const weekStartDate = new Date(startWindowMs + i * msPerWeek);
    const iso = weekStartDate.toISOString().slice(0, 10);
    const label = weekStartDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    buckets.push({ weekStart: iso, label, commits: 0 });
  }

  for (const c of commits) {
    const t = new Date(c.date).getTime();
    if (Number.isNaN(t) || t < startWindowMs) continue;
    const idx = Math.min(totalWeeks - 1, Math.max(0, Math.floor((t - startWindowMs) / msPerWeek)));
    buckets[idx].commits += 1;
  }

  return buckets;
}

export function calculateRepositoryAnalytics(input: AnalyticsInput): {
  productivityScore: number;
  consistencyScore: number;
  metricScores: MetricScores;
  analyticsSummary: AnalyticsSummary;
} {
  const {
    periodDays,
    defaultBranch,
    primaryLanguage,
    stars,
    forks,
    commits,
    contributors,
    pulls,
    sampledForReviews,
    docs,
  } = input;

  const dataWarnings: string[] = [];

  // 1. Weekly commit distribution & Consistency Score
  const weeklyCommits = buildWeeklyBuckets(commits, periodDays);
  const totalWeeks = weeklyCommits.length;
  const activeWeeks = weeklyCommits.filter((w) => w.commits > 0).length;
  const totalCommits = commits.length;

  let consistencyScore = 0;
  if (totalCommits === 0) {
    dataWarnings.push(
      `No commits found in the last ${periodDays} days. Consistency and commit frequency scores reflect zero recent activity.`
    );
  } else {
    const activeWeekRatio = activeWeeks / totalWeeks;
    const counts = weeklyCommits.map((w) => w.commits);
    const mean = counts.reduce((acc, v) => acc + v, 0) / counts.length;
    const variance =
      counts.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / counts.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean > 0 ? stdDev / mean : 2;
    const regularityFactor = Math.max(0, 1 - Math.min(1, cv / 2));
    consistencyScore = clampScore(activeWeekRatio * 70 + regularityFactor * 30);
  }

  // 2. Commit Frequency (0-100)
  // Uses weekly cadence blended with consistency; capped so burst commit spam cannot inflate score.
  const commitsPerWeek = totalWeeks > 0 ? totalCommits / totalWeeks : 0;
  const cadenceScore = Math.min(100, (commitsPerWeek / 6) * 100);
  const commitFrequency =
    totalCommits === 0
      ? 0
      : clampScore(cadenceScore * 0.65 + consistencyScore * 0.35);

  // 3. Code Quality Proxy Estimate (0-100)
  // IMPORTANT: Explicitly never equates higher commit count with higher code quality.
  // Uses non-static-analysis engineering hygiene proxies:
  //   - Commit message clarity (length >= 12 chars, non-generic)
  //   - PR merge discipline (merged / total closed PRs)
  //   - Pull request workflow usage
  const firstLines = commits.map((c) => c.message.split('\n')[0].trim()).filter(Boolean);
  const avgCommitMessageLength =
    firstLines.length > 0
      ? Math.round(
          firstLines.reduce((acc, msg) => acc + msg.length, 0) / firstLines.length
        )
      : 0;

  const descriptiveCount = firstLines.filter(
    (msg) =>
      msg.length >= 12 &&
      !GENERIC_COMMIT_PATTERNS.some((pattern) => pattern.test(msg))
  ).length;
  const descriptiveCommitRatio =
    firstLines.length > 0 ? descriptiveCount / firstLines.length : 0;

  const openPullRequests = pulls.filter((p) => p.state === 'open').length;
  const mergedPullRequests = pulls.filter((p) => Boolean(p.mergedAt)).length;
  const closedUnmergedPullRequests = pulls.filter(
    (p) => p.state === 'closed' && !p.mergedAt
  ).length;
  const totalPullRequests = pulls.length;
  const closedTotal = mergedPullRequests + closedUnmergedPullRequests;
  const mergeRatePercent =
    closedTotal > 0 ? Math.round((mergedPullRequests / closedTotal) * 100) : 0;

  let codeQualityEstimate = 0;
  if (totalCommits === 0 && totalPullRequests === 0) {
    codeQualityEstimate = 0;
  } else {
    const messageClarityComponent = descriptiveCommitRatio * 55;
    const prWorkflowComponent = totalPullRequests > 0 ? 20 : 0;
    const mergeDisciplineComponent =
      closedTotal > 0 ? (mergedPullRequests / closedTotal) * 25 : totalPullRequests > 0 ? 12 : 0;
    codeQualityEstimate = clampScore(
      messageClarityComponent + prWorkflowComponent + mergeDisciplineComponent
    );
  }
  dataWarnings.push(
    'Code Quality is a proxy-based estimate derived from commit message clarity and PR merge discipline (no static AST/linting performed).'
  );

  // 4. Collaboration (0-100)
  // Uses contributor count, commit distribution balance (avoiding single-author bottleneck), and PR usage.
  const contributorCommitMap = new Map<string, { avatarUrl: string; commits: number }>();
  for (const c of commits) {
    const existing = contributorCommitMap.get(c.authorLogin) || {
      avatarUrl: c.authorAvatarUrl,
      commits: 0,
    };
    existing.commits += 1;
    if (!existing.avatarUrl && c.authorAvatarUrl) {
      existing.avatarUrl = c.authorAvatarUrl;
    }
    contributorCommitMap.set(c.authorLogin, existing);
  }

  // Merge with repo contributors API so historical contributors are represented if recent window is small
  const topContributors: ContributorStat[] = [];
  if (contributorCommitMap.size > 0) {
    const sorted = Array.from(contributorCommitMap.entries()).sort(
      (a, b) => b[1].commits - a[1].commits
    );
    for (const [login, info] of sorted.slice(0, 12)) {
      topContributors.push({
        login,
        avatarUrl: info.avatarUrl,
        commits: info.commits,
        sharePercent: totalCommits > 0 ? Math.round((info.commits / totalCommits) * 100) : 0,
      });
    }
  } else if (contributors.length > 0) {
    const totalAll = contributors.reduce((acc, c) => acc + c.contributions, 0);
    for (const c of contributors.slice(0, 12)) {
      topContributors.push({
        login: c.login,
        avatarUrl: c.avatarUrl,
        commits: c.contributions,
        sharePercent: totalAll > 0 ? Math.round((c.contributions / totalAll) * 100) : 0,
      });
    }
  }

  const activeContributorCount =
    contributorCommitMap.size > 0 ? contributorCommitMap.size : contributors.length;
  const totalContributors = Math.max(contributors.length, contributorCommitMap.size);

  let collaboration = 0;
  if (totalContributors === 0 && totalPullRequests === 0) {
    collaboration = 0;
  } else {
    const contributorBreadth = Math.min(1, activeContributorCount / 4) * 45;
    let distributionBalance = 15;
    if (topContributors.length > 1) {
      const topShare = topContributors[0].sharePercent / 100;
      distributionBalance = Math.max(0, 1 - Math.max(0, topShare - 0.4)) * 30;
    }
    const prParticipation = Math.min(1, totalPullRequests / 10) * 25;
    collaboration = clampScore(contributorBreadth + distributionBalance + prParticipation);
  }

  if (totalContributors <= 1) {
    dataWarnings.push(
      'Single-contributor repository detected. Collaboration score reflects limited multi-developer activity.'
    );
  }

  // 5. Review Participation (0-100)
  const sampledPulls = pulls.slice(0, sampledForReviews);
  const reviewedPullRequests = sampledPulls.filter((p) => p.reviewCount > 0).length;
  const totalReviews = sampledPulls.reduce((acc, p) => acc + p.reviewCount, 0);
  const avgReviewCount =
    sampledForReviews > 0
      ? Number((totalReviews / sampledForReviews).toFixed(2))
      : 0;

  let reviewParticipation = 0;
  if (sampledForReviews === 0) {
    reviewParticipation = 0;
    dataWarnings.push(
      'No pull requests found in repository. Review Participation cannot be verified and is scored as 0.'
    );
  } else {
    const reviewedRatio = reviewedPullRequests / sampledForReviews;
    const depthFactor = Math.min(1, avgReviewCount / 1.5);
    reviewParticipation = clampScore(reviewedRatio * 70 + depthFactor * 30);
  }

  // 6. Documentation (0-100)
  let documentation = 0;
  if (docs.hasReadme) documentation += 35;
  if (docs.readmeLength >= 500) documentation += 20;
  else if (docs.readmeLength >= 150) documentation += 10;
  if (docs.hasDocsFolder) documentation += 20;
  if (docs.hasContributing) documentation += 15;
  if (docs.hasLicense) documentation += 10;
  documentation = clampScore(documentation);

  const metricScores: MetricScores = {
    commitFrequency,
    codeQualityEstimate,
    collaboration,
    reviewParticipation,
    documentation,
  };

  // Equal 20% weighted formula for clear academic presentation
  const weights = {
    commitFrequency: 0.2,
    codeQualityEstimate: 0.2,
    collaboration: 0.2,
    reviewParticipation: 0.2,
    documentation: 0.2,
  };

  const productivityScore = clampScore(
    metricScores.commitFrequency * weights.commitFrequency +
      metricScores.codeQualityEstimate * weights.codeQualityEstimate +
      metricScores.collaboration * weights.collaboration +
      metricScores.reviewParticipation * weights.reviewParticipation +
      metricScores.documentation * weights.documentation
  );

  const scoreBreakdown: ScoreBreakdownItem[] = [
    {
      metric: 'commitFrequency',
      label: 'Commit Frequency',
      score: metricScores.commitFrequency,
      weight: weights.commitFrequency,
      weightedContribution: Number((metricScores.commitFrequency * weights.commitFrequency).toFixed(1)),
      formulaExplanation:
        '65% weekly commit cadence (capped at 6 commits/week) + 35% weekly consistency score.',
      isProxyEstimate: false,
      dataStatus: totalCommits >= 5 ? 'sufficient' : totalCommits > 0 ? 'limited' : 'insufficient',
    },
    {
      metric: 'codeQualityEstimate',
      label: 'Code Quality (Proxy Estimate)',
      score: metricScores.codeQualityEstimate,
      weight: weights.codeQualityEstimate,
      weightedContribution: Number((metricScores.codeQualityEstimate * weights.codeQualityEstimate).toFixed(1)),
      formulaExplanation:
        'Proxy estimate only: 55% descriptive commit message ratio + 20% PR workflow usage + 25% PR merge rate.',
      isProxyEstimate: true,
      dataStatus: totalCommits >= 3 ? 'limited' : 'insufficient',
    },
    {
      metric: 'collaboration',
      label: 'Collaboration',
      score: metricScores.collaboration,
      weight: weights.collaboration,
      weightedContribution: Number((metricScores.collaboration * weights.collaboration).toFixed(1)),
      formulaExplanation:
        '45% active contributor breadth + 30% commit share balance + 25% pull request activity.',
      isProxyEstimate: false,
      dataStatus: totalContributors >= 2 ? 'sufficient' : totalContributors === 1 ? 'limited' : 'insufficient',
    },
    {
      metric: 'reviewParticipation',
      label: 'Review Participation',
      score: metricScores.reviewParticipation,
      weight: weights.reviewParticipation,
      weightedContribution: Number((metricScores.reviewParticipation * weights.reviewParticipation).toFixed(1)),
      formulaExplanation:
        '70% share of sampled PRs with >=1 code review + 30% average review depth per PR.',
      isProxyEstimate: false,
      dataStatus: sampledForReviews >= 3 ? 'sufficient' : sampledForReviews > 0 ? 'limited' : 'insufficient',
    },
    {
      metric: 'documentation',
      label: 'Documentation',
      score: metricScores.documentation,
      weight: weights.documentation,
      weightedContribution: Number((metricScores.documentation * weights.documentation).toFixed(1)),
      formulaExplanation:
        'README presence (35) + README depth >=500 chars (20) + docs/ folder (20) + CONTRIBUTING (15) + LICENSE (10).',
      isProxyEstimate: false,
      dataStatus: 'sufficient',
    },
  ];

  return {
    productivityScore,
    consistencyScore,
    metricScores,
    analyticsSummary: {
      totalCommits,
      totalContributors,
      totalPullRequests,
      mergedPullRequests,
      openPullRequests,
      closedUnmergedPullRequests,
      totalReviews,
      reviewedPullRequests,
      avgCommitMessageLength,
      descriptiveCommitRatio: Number((descriptiveCommitRatio * 100).toFixed(1)),
      hasReadme: docs.hasReadme,
      readmeLength: docs.readmeLength,
      hasDocsFolder: docs.hasDocsFolder,
      hasContributing: docs.hasContributing,
      hasLicense: docs.hasLicense,
      activeWeeks,
      totalWeeks,
      defaultBranch,
      primaryLanguage,
      stars,
      forks,
      weeklyCommits,
      topContributors,
      prStats: {
        open: openPullRequests,
        merged: mergedPullRequests,
        closedUnmerged: closedUnmergedPullRequests,
        sampledForReviews,
        reviewedPullRequests,
        totalReviews,
        avgReviewCount,
        mergeRatePercent,
      },
      dataWarnings,
      scoreBreakdown,
    },
  };
}
