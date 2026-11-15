import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Search } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { AnalyticsReportView } from '../components/AnalyticsReportView';
import { api, extractApiErrorMessage } from '../lib/api';
import { saveAnalysisReportClient } from '../lib/firebase';
import type { AnalysisReport, GitHubRepoSummary } from '../types/codevity';

const SAMPLE_REPOS = [
  { label: 'facebook/react', url: 'https://github.com/facebook/react' },
  { label: 'expressjs/express', url: 'https://github.com/expressjs/express' },
  { label: 'vitejs/vite', url: 'https://github.com/vitejs/vite' },
];

export function AnalyzePage() {
  const [searchParams] = useSearchParams();
  const initialUrl = searchParams.get('url') || '';

  const [repoUrl, setRepoUrl] = useState(initialUrl);
  const [periodDays, setPeriodDays] = useState<number>(90);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [statusNotice, setStatusNotice] = useState('');
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [userRepos, setUserRepos] = useState<GitHubRepoSummary[]>([]);

  useEffect(() => {
    if (initialUrl) {
      setRepoUrl(initialUrl);
    }
  }, [initialUrl]);

  useEffect(() => {
    let cancelled = false;
    async function loadConnectedRepos() {
      try {
        const statusRes = await api.get<{ connected: boolean }>('/github/status');
        if (statusRes.data.connected && !cancelled) {
          const reposRes = await api.get<{ repositories: GitHubRepoSummary[] }>(
            '/github/repositories'
          );
          if (!cancelled) {
            setUserRepos(reposRes.data.repositories.slice(0, 12));
          }
        }
      } catch {
        // Optional convenience list when GitHub is connected
      }
    }
    void loadConnectedRepos();
    return () => {
      cancelled = true;
    };
  }, []);

  const validateUrlInput = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) {
      return 'Please enter a GitHub repository URL or owner/repo.';
    }
    const isSlug = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(?:\.git)?\/?$/.test(trimmed);
    const isGitHubUrl = /^https?:\/\/(www\.)?github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+/i.test(
      trimmed
    );
    if (!isSlug && !isGitHubUrl) {
      return 'Enter a valid GitHub URL such as https://github.com/owner/repository.';
    }
    return null;
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setStatusNotice('');

    const validationError = validateUrlInput(repoUrl);
    if (validationError) {
      setError(validationError);
      return;
    }

    setAnalyzing(true);
    try {
      const res = await api.post<{
        report: AnalysisReport;
        persisted: boolean;
        persistenceWarning?: string;
      }>('/analyze', {
        repositoryUrl: repoUrl.trim(),
        periodDays,
        saveReport: true,
      });

      if (res.data.persisted) {
        setReport(res.data.report);
        setStatusNotice('Analysis complete and saved to My Reports in Cloud Firestore.');
      } else {
        try {
          const docId = await saveAnalysisReportClient(res.data.report);
          setReport({ ...res.data.report, id: docId });
          setStatusNotice('Analysis complete and saved to My Reports in Cloud Firestore.');
        } catch {
          setReport(res.data.report);
          if (res.data.persistenceWarning) {
            setStatusNotice(res.data.persistenceWarning);
          }
        }
      }
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Failed to analyse GitHub repository.'));
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <DashboardLayout breadcrumb="Analyse Repository">
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            Analyse a GitHub Repository
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Fetch real commits, contributors, pull requests, and reviews from GitHub to compute
            productivity scores and AI insights.
          </p>
        </div>

        {/* Repository URL Form */}
        <section className="bg-white border border-slate-200 rounded-xl p-6">
          <form onSubmit={handleAnalyze} className="space-y-4" noValidate>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-7">
                <label
                  htmlFor="repo-url-input"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  GitHub Repository URL
                </label>
                <div className="relative">
                  <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="repo-url-input"
                    type="url"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="https://github.com/facebook/react"
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div className="lg:col-span-3">
                <label
                  htmlFor="period-select"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Analysis Window
                </label>
                <select
                  id="period-select"
                  value={periodDays}
                  onChange={(e) => setPeriodDays(Number(e.target.value))}
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value={30}>Last 30 days</option>
                  <option value={60}>Last 60 days</option>
                  <option value={90}>Last 90 days</option>
                  <option value={180}>Last 180 days</option>
                </select>
              </div>

              <div className="lg:col-span-2 flex items-end">
                <button
                  type="submit"
                  disabled={analyzing}
                  className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 transition-colors whitespace-nowrap cursor-pointer"
                >
                  {analyzing ? 'Analysing...' : 'Run Analysis'}
                </button>
              </div>
            </div>

            {/* Quick-fill real public repositories or connected GitHub repos */}
            <div className="pt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>Public examples:</span>
              {SAMPLE_REPOS.map((sample) => (
                <button
                  key={sample.label}
                  type="button"
                  onClick={() => setRepoUrl(sample.url)}
                  className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono transition-colors cursor-pointer"
                >
                  {sample.label}
                </button>
              ))}
            </div>

            {userRepos.length > 0 && (
              <div className="pt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>Your GitHub repos:</span>
                {userRepos.slice(0, 6).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRepoUrl(r.htmlUrl)}
                    className="px-2.5 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-mono transition-colors cursor-pointer"
                  >
                    {r.fullName}
                  </button>
                ))}
              </div>
            )}
          </form>
        </section>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-sm text-rose-800">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {statusNotice && !analyzing && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{statusNotice}</span>
          </div>
        )}

        {analyzing && (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
            <div className="h-8 w-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mx-auto" />
            <p className="font-display text-base font-semibold text-slate-900">
              Fetching live GitHub repository telemetry...
            </p>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Collecting commits, contributors, pull requests, review history, and documentation
              signals, then running the scoring engine and Groq AI insights.
            </p>
          </div>
        )}

        {report && !analyzing && <AnalyticsReportView report={report} />}
      </div>
    </DashboardLayout>
  );
}
