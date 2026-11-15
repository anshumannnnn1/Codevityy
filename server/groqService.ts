import axios from 'axios';
import type {
  AIInsights,
  AnalyticsSummary,
  MetricScores,
} from '../src/types/codevity.ts';

interface GroqInsightsInput {
  repositoryName: string;
  analysisPeriodDays: number;
  productivityScore: number;
  consistencyScore: number;
  metricScores: MetricScores;
  analyticsSummary: AnalyticsSummary;
}

function sanitizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, 5);
}

export async function generateGroqInsights(
  input: GroqInsightsInput
): Promise<AIInsights> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  const model = process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile';

  if (!apiKey) {
    return {
      available: false,
      provider: 'none',
      model: '',
      errorMessage:
        'Groq AI insights are unavailable because GROQ_API_KEY is not configured on the server. All calculated analytics above remain accurate.',
      strengths: [],
      improvementAreas: [],
      recommendations: [],
    };
  }

  const groundedMetrics = {
    repository: input.repositoryName,
    analysisPeriodDays: input.analysisPeriodDays,
    productivityScore: input.productivityScore,
    consistencyScore: input.consistencyScore,
    metricScores: input.metricScores,
    facts: {
      totalCommits: input.analyticsSummary.totalCommits,
      totalContributors: input.analyticsSummary.totalContributors,
      totalPullRequests: input.analyticsSummary.totalPullRequests,
      mergedPullRequests: input.analyticsSummary.mergedPullRequests,
      openPullRequests: input.analyticsSummary.openPullRequests,
      sampledForReviews: input.analyticsSummary.prStats.sampledForReviews,
      reviewedPullRequests: input.analyticsSummary.reviewedPullRequests,
      totalReviews: input.analyticsSummary.totalReviews,
      avgCommitMessageLength: input.analyticsSummary.avgCommitMessageLength,
      descriptiveCommitRatioPercent: input.analyticsSummary.descriptiveCommitRatio,
      activeWeeks: input.analyticsSummary.activeWeeks,
      totalWeeks: input.analyticsSummary.totalWeeks,
      hasReadme: input.analyticsSummary.hasReadme,
      readmeLength: input.analyticsSummary.readmeLength,
      hasDocsFolder: input.analyticsSummary.hasDocsFolder,
      hasContributing: input.analyticsSummary.hasContributing,
      hasLicense: input.analyticsSummary.hasLicense,
      primaryLanguage: input.analyticsSummary.primaryLanguage,
      dataWarnings: input.analyticsSummary.dataWarnings,
    },
  };

  try {
    const response = await axios.post<{
      choices?: Array<{ message?: { content?: string } }>;
    }>(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are a software engineering productivity analyst for Codevity. Base every statement strictly on the provided JSON metrics and facts. NEVER invent numbers, statistics, scores, or repository facts not present in the input. Note that codeQualityEstimate is a proxy estimate based on commit messages and PR discipline, not static analysis. Return valid JSON only with keys: "strengths" (array of 3 concise strings), "improvementAreas" (array of 3 concise strings), and "recommendations" (array of 3 practical actionable strings).',
          },
          {
            role: 'user',
            content: `Analyze this verified GitHub repository telemetry and generate grounded insights:\n${JSON.stringify(
              groundedMetrics,
              null,
              2
            )}`,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      }
    );

    const content = response.data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response received from Groq API.');
    }

    const parsed = JSON.parse(content) as {
      strengths?: unknown;
      improvementAreas?: unknown;
      recommendations?: unknown;
    };

    const strengths = sanitizeStringList(parsed.strengths);
    const improvementAreas = sanitizeStringList(parsed.improvementAreas);
    const recommendations = sanitizeStringList(parsed.recommendations);

    if (
      strengths.length === 0 &&
      improvementAreas.length === 0 &&
      recommendations.length === 0
    ) {
      throw new Error('Groq response did not include valid insight lists.');
    }

    return {
      available: true,
      provider: 'groq',
      model,
      errorMessage: '',
      strengths,
      improvementAreas,
      recommendations,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unable to reach Groq API.';
    console.error('Groq AI insight generation failed:', message);
    return {
      available: false,
      provider: 'none',
      model,
      errorMessage: `AI insights temporarily unavailable (${message}). Calculated repository metrics are displayed above.`,
      strengths: [],
      improvementAreas: [],
      recommendations: [],
    };
  }
}
