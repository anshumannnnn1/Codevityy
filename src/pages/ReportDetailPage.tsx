import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { AnalyticsReportView } from '../components/AnalyticsReportView';
import { api, extractApiErrorMessage } from '../lib/api';
import { fetchReportByIdClient } from '../lib/firebase';
import type { AnalysisReport } from '../types/codevity';

export function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadReport() {
      if (!id) return;
      setLoading(true);
      setError('');
      try {
        const clientDoc = await fetchReportByIdClient(id);
        if (!cancelled) {
          if (clientDoc) {
            setReport(clientDoc);
          } else {
            setError('Analysis report not found.');
          }
        }
      } catch {
        try {
          const res = await api.get<{ report: AnalysisReport }>(`/reports/${id}`);
          if (!cancelled) setReport(res.data.report);
        } catch (err) {
          if (!cancelled) {
            setError(extractApiErrorMessage(err, 'Failed to load analysis report.'));
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadReport();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <DashboardLayout breadcrumb={report ? report.repositoryName : 'Report Details'}>
      <div className="space-y-6">
        <div>
          <Link
            to="/reports"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to My Reports</span>
          </Link>
        </div>

        {loading && (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
            <div className="h-7 w-7 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mx-auto" />
            <p className="mt-3 text-sm text-slate-600">Loading saved analysis report...</p>
          </div>
        )}

        {error && !loading && (
          <div className="p-5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-sm text-rose-800">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {report && !loading && <AnalyticsReportView report={report} />}
      </div>
    </DashboardLayout>
  );
}
