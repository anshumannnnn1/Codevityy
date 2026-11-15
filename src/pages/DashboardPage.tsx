import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  FileText,
  GitBranch,
  Search,
} from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { api, extractApiErrorMessage } from '../lib/api';
import { fetchUserReportsClient } from '../lib/firebase';
import type { AnalysisReport, GitHubConnectionState } from '../types/codevity';

export function DashboardPage() {
  const { user, profile } = useAuth();
  const [reports, setReports] = useState<AnalysisReport[]>([]);
  const [ghStatus, setGhStatus] = useState<GitHubConnectionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadDashboard() {
      if (!user) return;
      setLoading(true);
      setError('');
      try {
        const [reportsRes, statusRes] = await Promise.allSettled([
          fetchUserReportsClient(user.uid),
          api.get<GitHubConnectionState>('/github/status'),
        ]);

        if (cancelled) return;

        if (reportsRes.status === 'fulfilled') {
          setReports(reportsRes.value);
        } else {
          // Fallback to backend API if client Firestore query had an issue
          try {
            const apiReports = await api.get<{ reports: AnalysisReport[] }>('/reports');
            if (!cancelled) setReports(apiReports.data.reports);
          } catch (innerErr) {
            if (!cancelled) {
              setError(extractApiErrorMessage(innerErr, 'Could not load saved reports.'));
            }
          }
        }

        if (statusRes.status === 'fulfilled') {
          setGhStatus(statusRes.value.data);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const firstName = (profile?.name || user?.displayName || 'Developer').split(' ')[0];
  const avgScore =
    reports.length > 0
      ? Math.round(
          reports.reduce((acc, r) => acc + r.productivityScore, 0) / reports.length
        )
      : null;

  return (
    <DashboardLayout breadcrumb="Dashboard">
      <div className="space-y-8">
        {/* Welcome Header */}
        <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
              Welcome back, {firstName}
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Review your connected GitHub account and recent repository productivity analyses.
            </p>
          </div>
          <Link
            to="/analyze"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors whitespace-nowrap self-start"
          >
            <Search className="h-4 w-4" />
            <span>Analyse a Repository</span>
          </Link>
        </section>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-sm text-rose-800">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Overview KPI Row */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
                <span>GitHub Account</span>
                <GitBranch className="h-4 w-4 text-slate-400" />
              </div>
              {loading ? (
                <div className="h-6 w-36 bg-slate-100 rounded animate-pulse" />
              ) : ghStatus?.connected ? (
                <p className="font-display text-lg font-semibold text-slate-900">
                  @{ghStatus.githubUsername}
                </p>
              ) : (
                <p className="font-display text-lg font-semibold text-slate-900">
                  Not Connected
                </p>
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                {ghStatus?.connected
                  ? 'Public & private repos enabled'
                  : 'Public repos only until connected'}
              </span>
              <Link
                to="/github"
                className="font-medium text-indigo-600 hover:text-indigo-700 whitespace-nowrap"
              >
                {ghStatus?.connected ? 'Manage' : 'Connect'}
              </Link>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
                <span>Repositories Analysed</span>
                <FileText className="h-4 w-4 text-slate-400" />
              </div>
              {loading ? (
                <div className="h-8 w-16 bg-slate-100 rounded animate-pulse" />
              ) : (
                <p className="font-mono text-3xl font-bold text-slate-900 tabular-nums">
                  {reports.length}
                </p>
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">Saved in Cloud Firestore</span>
              <Link
                to="/reports"
                className="font-medium text-indigo-600 hover:text-indigo-700 whitespace-nowrap"
              >
                View all
              </Link>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">
                Average Productivity Score
              </p>
              {loading ? (
                <div className="h-8 w-20 bg-slate-100 rounded animate-pulse" />
              ) : avgScore !== null ? (
                <p className="font-mono text-3xl font-bold text-indigo-700 tabular-nums">
                  {avgScore}
                  <span className="text-sm font-normal text-slate-400"> / 100</span>
                </p>
              ) : (
                <p className="font-mono text-3xl font-bold text-slate-300 tabular-nums">
                  —
                </p>
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
              Across your saved repository analyses
            </div>
          </div>
        </section>

        {/* Recent Analysis Reports */}
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Recent Analysis Reports
              </h2>
              <p className="text-xs text-slate-500">
                Your latest repository evaluations stored in Firestore
              </p>
            </div>
            {reports.length > 0 && (
              <Link
                to="/reports"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700 whitespace-nowrap"
              >
                All reports
              </Link>
            )}
          </div>

          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((row) => (
                <div key={row} className="h-10 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <div className="p-10 text-center">
              <p className="font-display text-base font-semibold text-slate-900">
                No analysis reports yet
              </p>
              <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
                Enter any public GitHub repository URL or connect your GitHub account to run your
                first productivity analysis.
              </p>
              <Link
                to="/analyze"
                className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
              >
                <span>Analyse First Repository</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 font-medium">Repository</th>
                    <th className="px-6 py-3 font-medium">Analysed</th>
                    <th className="px-6 py-3 font-medium text-right">Productivity</th>
                    <th className="px-6 py-3 font-medium text-right">Consistency</th>
                    <th className="px-6 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reports.slice(0, 6).map((report) => (
                    <tr key={report.id} className="hover:bg-slate-50/70">
                      <td className="px-6 py-3.5 font-medium text-slate-900">
                        <div>{report.repositoryName}</div>
                        <div className="text-xs text-slate-500 font-normal">
                          {report.isPrivate ? 'Private' : 'Public'} · {report.analysisPeriodDays}d window
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-slate-600 whitespace-nowrap">
                        {new Date(report.analysisDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono font-semibold text-indigo-700 tabular-nums">
                        {report.productivityScore} / 100
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono text-slate-700 tabular-nums">
                        {report.consistencyScore} / 100
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <Link
                          to={`/reports/${report.id}`}
                          className="text-sm font-medium text-indigo-600 hover:text-indigo-700 whitespace-nowrap"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
