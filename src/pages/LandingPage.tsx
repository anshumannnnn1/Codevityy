import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, CheckCircle2, GitBranch, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function LandingPage() {
  const { user } = useAuth();
  const [imgError, setImgError] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Three-Zone Top Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <Link
            to="/"
            className="flex items-center gap-2.5 font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            <span className="h-7 w-7 rounded-md bg-indigo-600 text-white flex items-center justify-center">
              <BarChart3 className="h-4 w-4" />
            </span>
            <span>Codevity</span>
          </Link>

          {/* Zone 2: Concise Single-Line Nav Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a
              href="#features"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              How It Works
            </a>
            <a
              href="#scoring"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Scoring Model
            </a>
            <Link
              to="/login"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Log In
            </Link>
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to={user ? '/dashboard' : '/signup'}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors whitespace-nowrap shrink-0"
            >
              {user ? 'Open Dashboard' : 'Sign Up'}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-6 py-16 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-sm font-medium text-indigo-600 mb-3">
                Developer Productivity & Repository Analytics
              </p>
              <h1
                className="font-display font-bold text-slate-900 tracking-tight text-balance"
                style={{ fontSize: 'clamp(2.25rem, 4vw, 3.35rem)', lineHeight: 1.12 }}
              >
                Measure real GitHub engineering workflow, not vanity commit counts.
              </h1>
              <p className="mt-5 text-base text-slate-600 leading-relaxed max-w-xl">
                Codevity analyses commit consistency, pull request discipline, code review
                participation, contributor balance, and documentation hygiene using live GitHub
                repository data and transparent weighted scoring.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  to={user ? '/dashboard' : '/signup'}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors whitespace-nowrap"
                >
                  <span>{user ? 'Go to Dashboard' : 'Create Free Account'}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors whitespace-nowrap"
                >
                  <span>Log In</span>
                </Link>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500">
                <span>Live GitHub REST API</span>
                <span aria-hidden="true">·</span>
                <span>Explainable 5-Metric Formula</span>
                <span aria-hidden="true">·</span>
                <span>Groq AI Insights</span>
                <span aria-hidden="true">·</span>
                <span>Firestore Report History</span>
              </div>
            </div>

            <div className="lg:col-span-6 flex items-stretch">
              <div className="w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100 min-h-[280px]">
                {!imgError ? (
                  <img
                    src="/src/assets/images/hero_codevity_analytics_1794732153504.jpg"
                    alt="Software engineering workstation displaying Codevity repository analytics charts"
                    referrerPolicy="no-referrer"
                    onError={() => setImgError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-slate-100">
                    <BarChart3 className="h-10 w-10 text-indigo-600 mb-3" />
                    <p className="font-display font-semibold text-slate-900">
                      Repository Productivity Dashboard
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      Commit cadence, pull request reviews, and contributor insights
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Core Capabilities */}
        <section id="features" className="max-w-7xl mx-auto px-6 py-20">
          <div className="max-w-2xl mb-12">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Built for transparent engineering evaluation
            </h2>
            <p className="mt-3 text-slate-600">
              Designed to replace opaque developer metrics with verifiable repository signals and
              reproducible scoring formulas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 lg:col-span-2">
              <p className="text-xs font-medium text-indigo-600 mb-2">
                01. Multi-Signal Repository Analysis
              </p>
              <h3 className="font-display text-lg font-semibold text-slate-900">
                Commits, Pull Requests, Reviews, and Documentation
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Instead of rewarding raw commit volume, Codevity tracks weekly commit consistency,
                pull request merge rates, peer code review participation across sampled PRs,
                contributor workload distribution, and documentation completeness.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <p className="text-xs font-medium text-indigo-600 mb-2">
                02. GitHub OAuth Security
              </p>
              <h3 className="font-display text-lg font-semibold text-slate-900">
                Server-Side Token Vault
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Analyse public repositories immediately or authorise GitHub OAuth to include
                private repositories. Access tokens remain encrypted on the backend and are never
                exposed to browser code.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <p className="text-xs font-medium text-indigo-600 mb-2">
                03. Grounded AI Feedback
              </p>
              <h3 className="font-display text-lg font-semibold text-slate-900">
                Groq API Insights
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Server-side Groq inference reads only your calculated metrics to surface grounded
                strengths, improvement areas, and practical next steps without fabricating stats.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 lg:col-span-2">
              <p className="text-xs font-medium text-indigo-600 mb-2">
                04. Persistent Cloud Firestore Reports
              </p>
              <h3 className="font-display text-lg font-semibold text-slate-900">
                Private Report History Per Developer
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Every completed analysis is stored in Cloud Firestore under strict user-scoped
                security rules so you can revisit historical scorecards, compare repositories over
                time, and present verified charts.
              </p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="bg-white border-y border-slate-200">
          <div className="max-w-7xl mx-auto px-6 py-20">
            <div className="max-w-2xl mb-12">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                How Codevity Works
              </h2>
              <p className="mt-3 text-slate-600">
                Four straightforward stages from repository URL to saved productivity report.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  step: '01. Authenticate',
                  title: 'Create Account & Optional GitHub OAuth',
                  desc: 'Sign in with Firebase Authentication and optionally connect your GitHub account to access private repositories.',
                },
                {
                  step: '02. Fetch Telemetry',
                  title: 'Validate URL & Pull GitHub API Data',
                  desc: 'The Express backend fetches repository metadata, commit history, contributors, PRs, reviews, and docs.',
                },
                {
                  step: '03. Score Metrics',
                  title: 'Run Transparent Scoring Engine',
                  desc: 'Calculates Consistency, Productivity, and five 0–100 metric scores with documented weights and proxy labels.',
                },
                {
                  step: '04. Review & Save',
                  title: 'Visualise Charts & AI Insights',
                  desc: 'Inspect Recharts activity graphs and Groq-powered recommendations, saved automatically to Firestore.',
                },
              ].map((item) => (
                <div key={item.step} className="border border-slate-200 rounded-xl p-6 bg-slate-50/50">
                  <p className="text-xs font-mono font-medium text-indigo-600 mb-2">{item.step}</p>
                  <h3 className="font-display text-base font-semibold text-slate-900">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Transparent Scoring Model */}
        <section id="scoring" className="max-w-7xl mx-auto px-6 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Explainable Scoring Methodology
              </h2>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                Every Productivity Score is the weighted sum of five 0–100 indicators. Proxy-based
                metrics such as Code Quality are explicitly labeled so teams never confuse commit
                hygiene signals with static code analysis.
              </p>
              <div className="mt-6 space-y-2.5 text-sm text-slate-700">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-indigo-600 shrink-0" />
                  <span>More commits never automatically increase Code Quality</span>
                </div>
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-indigo-600 shrink-0" />
                  <span>Missing PRs or empty repos surface explicit data warnings</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-indigo-600 shrink-0" />
                  <span>Full calculation breakdown included on every report</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3 font-medium">Metric</th>
                    <th className="px-5 py-3 font-medium text-right">Weight</th>
                    <th className="px-5 py-3 font-medium">Primary Signals</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-5 py-3 font-medium text-slate-900">Commit Frequency</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums">20%</td>
                    <td className="px-5 py-3 text-slate-600">Weekly commit cadence + regularity</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3 font-medium text-slate-900">Code Quality (Proxy)</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums">20%</td>
                    <td className="px-5 py-3 text-slate-600">Descriptive commit messages + PR merge rate</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3 font-medium text-slate-900">Collaboration</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums">20%</td>
                    <td className="px-5 py-3 text-slate-600">Active contributors + workload balance + PRs</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3 font-medium text-slate-900">Review Participation</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums">20%</td>
                    <td className="px-5 py-3 text-slate-600">Reviewed PR ratio + reviews per PR</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3 font-medium text-slate-900">Documentation</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums">20%</td>
                    <td className="px-5 py-3 text-slate-600">README depth, docs/, CONTRIBUTING, LICENSE</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-3">
            <span className="font-display font-semibold text-slate-900">Codevity</span>
            <span aria-hidden="true">·</span>
            <span>Developer Productivity Analyser</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/login" className="hover:text-slate-900">
              Log In
            </Link>
            <Link to="/signup" className="hover:text-slate-900">
              Sign Up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
