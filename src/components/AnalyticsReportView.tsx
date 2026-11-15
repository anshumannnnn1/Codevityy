import React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  GitCommit,
  GitPullRequest,
  Lightbulb,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import type { AnalysisReport } from '../types/codevity';

interface AnalyticsReportViewProps {
  report: AnalysisReport;
}

function getScoreTextColor(score: number): string {
  if (score >= 75) return 'text-emerald-700';
  if (score >= 50) return 'text-indigo-700';
  if (score >= 30) return 'text-amber-700';
  return 'text-rose-700';
}

function getBarColor(score: number): string {
  if (score >= 75) return 'bg-emerald-600';
  if (score >= 50) return 'bg-indigo-600';
  if (score >= 30) return 'bg-amber-500';
  return 'bg-rose-500';
}

export function AnalyticsReportView({ report }: AnalyticsReportViewProps) {
  const { analyticsSummary, metricScores, aiInsights } = report;

  const radarData = [
    { metric: 'Commit Freq.', score: metricScores.commitFrequency },
    { metric: 'Quality (Est.)', score: metricScores.codeQualityEstimate },
    { metric: 'Collaboration', score: metricScores.collaboration },
    { metric: 'Reviews', score: metricScores.reviewParticipation },
    { metric: 'Docs', score: metricScores.documentation },
  ];

  const prChartData = [
    { label: 'Open', count: analyticsSummary.prStats.open },
    { label: 'Merged', count: analyticsSummary.prStats.merged },
    { label: 'Closed Unmerged', count: analyticsSummary.prStats.closedUnmerged },
    { label: 'Reviewed (Sample)', count: analyticsSummary.prStats.reviewedPullRequests },
  ];

  const formattedDate = new Date(report.analysisDate).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <div className="space-y-8">
      {/* Repository Header Summary */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-1.5">
              <span>{report.repositoryOwner}</span>
              <span aria-hidden="true">·</span>
              <span>{report.isPrivate ? 'Private Repository' : 'Public Repository'}</span>
              <span aria-hidden="true">·</span>
              <span>{analyticsSummary.primaryLanguage}</span>
              <span aria-hidden="true">·</span>
              <span>{report.analysisPeriodDays}-day window</span>
              <span aria-hidden="true">·</span>
              <span>Analysed {formattedDate}</span>
            </div>
            <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
              {report.repositoryName}
            </h1>
          </div>

          <a
            href={report.repositoryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0 self-start"
          >
            <span>View on GitHub</span>
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        {/* Data transparency notices */}
        {analyticsSummary.dataWarnings.length > 0 && (
          <div className="mt-5 pt-4 border-t border-slate-100 space-y-1.5">
            {analyticsSummary.dataWarnings.map((warning, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 text-xs text-slate-600"
              >
                <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>{warning}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Primary KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 mb-2">Overall Productivity</p>
          <p className={`font-mono text-3xl font-bold tabular-nums ${getScoreTextColor(report.productivityScore)}`}>
            {report.productivityScore}
            <span className="text-sm font-normal text-slate-400"> / 100</span>
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 mb-2">Consistency Score</p>
          <p className={`font-mono text-3xl font-bold tabular-nums ${getScoreTextColor(report.consistencyScore)}`}>
            {report.consistencyScore}
            <span className="text-sm font-normal text-slate-400"> / 100</span>
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
            <span>Total Commits</span>
            <GitCommit className="h-4 w-4 text-slate-400" />
          </div>
          <p className="font-mono text-3xl font-bold text-slate-900 tabular-nums">
            {analyticsSummary.totalCommits}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
            <span>Contributors</span>
            <Users className="h-4 w-4 text-slate-400" />
          </div>
          <p className="font-mono text-3xl font-bold text-slate-900 tabular-nums">
            {analyticsSummary.totalContributors}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
            <span>Pull Requests</span>
            <GitPullRequest className="h-4 w-4 text-slate-400" />
          </div>
          <p className="font-mono text-3xl font-bold text-slate-900 tabular-nums">
            {analyticsSummary.totalPullRequests}
          </p>
        </div>
      </section>

      {/* Five Metric Scores + Radar Chart */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          <div className="mb-5">
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Five Metric Score Breakdown
            </h2>
            <p className="text-sm text-slate-500">
              Equal-weighted (20% each) scoring calculated from verified GitHub activity signals.
            </p>
          </div>

          <div className="space-y-5">
            {analyticsSummary.scoreBreakdown.map((item) => (
              <div key={item.metric}>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{item.label}</span>
                    {item.isProxyEstimate && (
                      <span className="text-xs text-amber-700 font-medium">
                        Proxy Estimate
                      </span>
                    )}
                  </div>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {item.score} / 100
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${getBarColor(item.score)}`}
                    style={{ width: `${item.score}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">{item.formulaExplanation}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col">
          <div className="mb-2">
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Metric Profile Visualisation
            </h2>
            <p className="text-sm text-slate-500">
              Balanced view across all five engineering dimensions.
            </p>
          </div>
          <div className="flex-1 min-h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="72%">
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis
                  dataKey="metric"
                  tick={{ fill: '#475569', fontSize: 12 }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                />
                <Radar
                  name="Score"
                  dataKey="score"
                  stroke="#4f46e5"
                  fill="#4f46e5"
                  fillOpacity={0.22}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    borderColor: '#e2e8f0',
                    fontSize: '12px',
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Commit Activity & Contributor Activity Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900">
                Weekly Commit Activity
              </h2>
              <p className="text-sm text-slate-500">
                {analyticsSummary.activeWeeks} of {analyticsSummary.totalWeeks} weeks had commits
              </p>
            </div>
          </div>

          {analyticsSummary.weeklyCommits.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analyticsSummary.weeklyCommits}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      borderColor: '#e2e8f0',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="commits"
                    name="Commits"
                    stroke="#4f46e5"
                    strokeWidth={2}
                    fill="#e0e7ff"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-slate-500">
              No commit timeline data available for this period.
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="mb-4">
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Contributor Activity
            </h2>
            <p className="text-sm text-slate-500">
              Top contributors by commit volume in the analysed window
            </p>
          </div>

          {analyticsSummary.topContributors.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={analyticsSummary.topContributors.slice(0, 8)}
                  layout="vertical"
                  margin={{ left: 16, right: 16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <YAxis
                    type="category"
                    dataKey="login"
                    width={100}
                    tick={{ fill: '#334155', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      borderColor: '#e2e8f0',
                      fontSize: '12px',
                    }}
                  />
                  <Bar
                    dataKey="commits"
                    name="Commits"
                    fill="#2563eb"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-slate-500">
              No contributor records available for this repository.
            </div>
          )}
        </div>
      </section>

      {/* Pull Request Statistics & Repository Activity Summary */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="mb-4">
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Pull Request & Review Statistics
            </h2>
            <p className="text-sm text-slate-500">
              Merge rate: <span className="font-mono font-medium text-slate-900 tabular-nums">{analyticsSummary.prStats.mergeRatePercent}%</span> · Avg reviews per sampled PR: <span className="font-mono font-medium text-slate-900 tabular-nums">{analyticsSummary.prStats.avgReviewCount}</span>
            </p>
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={prChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    borderColor: '#e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" name="Pull Requests" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="mb-4">
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Repository Activity & Documentation Summary
            </h2>
            <p className="text-sm text-slate-500">
              Verifiable repository metadata and engineering hygiene signals
            </p>
          </div>

          <dl className="divide-y divide-slate-100 text-sm">
            <div className="py-2.5 flex items-center justify-between">
              <dt className="text-slate-600">Default Branch</dt>
              <dd className="font-mono text-slate-900">{analyticsSummary.defaultBranch}</dd>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <dt className="text-slate-600">Stars / Forks</dt>
              <dd className="font-mono text-slate-900 tabular-nums">
                {analyticsSummary.stars} / {analyticsSummary.forks}
              </dd>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <dt className="text-slate-600">Avg. Commit Message Length</dt>
              <dd className="font-mono text-slate-900 tabular-nums">
                {analyticsSummary.avgCommitMessageLength} chars
              </dd>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <dt className="text-slate-600">Descriptive Commit Ratio</dt>
              <dd className="font-mono text-slate-900 tabular-nums">
                {analyticsSummary.descriptiveCommitRatio}%
              </dd>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <dt className="text-slate-600">README Documentation</dt>
              <dd className="font-medium text-slate-900">
                {analyticsSummary.hasReadme
                  ? `Present (${analyticsSummary.readmeLength} chars)`
                  : 'Missing'}
              </dd>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <dt className="text-slate-600">Docs Folder / Contributing / License</dt>
              <dd className="font-medium text-slate-900">
                {[
                  analyticsSummary.hasDocsFolder ? 'docs/' : 'No docs/',
                  analyticsSummary.hasContributing ? 'CONTRIBUTING' : 'No CONTRIBUTING',
                  analyticsSummary.hasLicense ? 'LICENSE' : 'No LICENSE',
                ].join(' · ')}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* AI Insights (Groq API) */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-5 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            <h2 className="font-display text-lg font-semibold text-slate-900">
              AI Insights & Recommendations
            </h2>
          </div>
          {aiInsights.available && (
            <span className="text-xs text-slate-500 font-mono">
              Powered by Groq · {aiInsights.model}
            </span>
          )}
        </div>

        {!aiInsights.available ? (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-slate-900">
                AI Service Unavailable
              </p>
              <p className="text-sm text-slate-600 mt-0.5">
                {aiInsights.errorMessage}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 mb-3">
                <CheckCircle2 className="h-4 w-4" />
                <span>Repository Strengths</span>
              </div>
              <ul className="space-y-2.5 text-sm text-slate-700">
                {aiInsights.strengths.map((item, idx) => (
                  <li key={idx} className="leading-relaxed">
                    • {item}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 mb-3">
                <TrendingUp className="h-4 w-4" />
                <span>Improvement Areas</span>
              </div>
              <ul className="space-y-2.5 text-sm text-slate-700">
                {aiInsights.improvementAreas.map((item, idx) => (
                  <li key={idx} className="leading-relaxed">
                    • {item}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-indigo-700 mb-3">
                <Lightbulb className="h-4 w-4" />
                <span>Actionable Recommendations</span>
              </div>
              <ul className="space-y-2.5 text-sm text-slate-700">
                {aiInsights.recommendations.map((item, idx) => (
                  <li key={idx} className="leading-relaxed">
                    • {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>

      {/* Transparent Weighted Scoring Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Transparent Scoring Formula Reference
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Overall Productivity Score = Sum of (Metric Score × Weight) across all five dimensions.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 font-medium">Metric</th>
                <th className="px-6 py-3 font-medium text-right">Score</th>
                <th className="px-6 py-3 font-medium text-right">Weight</th>
                <th className="px-6 py-3 font-medium text-right">Contribution</th>
                <th className="px-6 py-3 font-medium">Basis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {analyticsSummary.scoreBreakdown.map((row) => (
                <tr key={row.metric} className="hover:bg-slate-50/70">
                  <td className="px-6 py-3 font-medium text-slate-900">{row.label}</td>
                  <td className="px-6 py-3 text-right font-mono tabular-nums text-slate-900">
                    {row.score}
                  </td>
                  <td className="px-6 py-3 text-right font-mono tabular-nums text-slate-600">
                    {Math.round(row.weight * 100)}%
                  </td>
                  <td className="px-6 py-3 text-right font-mono tabular-nums font-medium text-indigo-700">
                    {row.weightedContribution}
                  </td>
                  <td className="px-6 py-3 text-xs text-slate-600">{row.formulaExplanation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
