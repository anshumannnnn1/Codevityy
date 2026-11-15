import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, Search, Trash2 } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { api, extractApiErrorMessage } from '../lib/api';
import { deleteReportClient, fetchUserReportsClient } from '../lib/firebase';
import type { AnalysisReport } from '../types/codevity';

export function ReportsPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<AnalysisReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'score'>('date');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) return;
      setLoading(true);
      setError('');
      try {
        const list = await fetchUserReportsClient(user.uid);
        if (!cancelled) setReports(list);
      } catch {
        try {
          const res = await api.get<{ reports: AnalysisReport[] }>('/reports');
          if (!cancelled) setReports(res.data.reports);
        } catch (err) {
          if (!cancelled) {
            setError(extractApiErrorMessage(err, 'Failed to load saved reports.'));
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setError('');
    try {
      await deleteReportClient(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch {
      try {
        await api.delete(`/reports/${id}`);
        setReports((prev) => prev.filter((r) => r.id !== id));
      } catch (err) {
        setError(extractApiErrorMessage(err, 'Failed to delete report.'));
      }
    } finally {
      setDeletingId(null);
    }
  };

  const filteredReports = reports
    .filter((r) =>
      r.repositoryName.toLowerCase().includes(searchQuery.trim().toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'score') {
        return b.productivityScore - a.productivityScore;
      }
      return (
        new Date(b.analysisDate).getTime() - new Date(a.analysisDate).getTime()
      );
    });

  return (
    <DashboardLayout breadcrumb="My Reports">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
              My Analysis Reports
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Historical repository productivity evaluations saved privately to your account.
            </p>
          </div>
          <Link
            to="/analyze"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors whitespace-nowrap self-start"
          >
            <span>New Analysis</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-sm text-rose-800">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Filter & Sort Toolbar */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by repository name..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
            <button
              type="button"
              onClick={() => setSortBy('date')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                sortBy === 'date'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Newest First
            </button>
            <button
              type="button"
              onClick={() => setSortBy('score')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                sortBy === 'score'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Highest Score
            </button>
          </div>
        </div>

        {/* Reports Table */}
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-12 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="p-12 text-center">
              <p className="font-display text-base font-semibold text-slate-900">
                {reports.length === 0
                  ? 'No saved reports yet'
                  : 'No reports match your filter'}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {reports.length === 0
                  ? 'Run an analysis on any GitHub repository to save your first report.'
                  : 'Try clearing the repository name search box.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 font-medium">Repository</th>
                    <th className="px-6 py-3 font-medium">Analysis Date</th>
                    <th className="px-6 py-3 font-medium text-right">Commits</th>
                    <th className="px-6 py-3 font-medium text-right">Productivity</th>
                    <th className="px-6 py-3 font-medium text-right">Consistency</th>
                    <th className="px-6 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredReports.map((report) => (
                    <tr key={report.id} className="hover:bg-slate-50/70">
                      <td className="px-6 py-4 font-medium text-slate-900">
                        <div>{report.repositoryName}</div>
                        <div className="text-xs text-slate-500 font-normal">
                          {report.isPrivate ? 'Private' : 'Public'} · {report.analysisPeriodDays}d
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                        {new Date(report.analysisDate).toLocaleString('en-US', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="px-6 py-4 text-right font-mono tabular-nums text-slate-700">
                        {report.analyticsSummary?.totalCommits ?? 0}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-semibold text-indigo-700 tabular-nums">
                        {report.productivityScore} / 100
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-slate-700 tabular-nums">
                        {report.consistencyScore} / 100
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-3">
                          <Link
                            to={`/reports/${report.id}`}
                            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                          >
                            Open
                          </Link>
                          <button
                            type="button"
                            disabled={deletingId === report.id}
                            onClick={() => report.id && handleDelete(report.id)}
                            aria-label={`Delete report for ${report.repositoryName}`}
                            className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
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
