import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  GitBranch,
  Lock,
  RefreshCw,
  Unlink,
} from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { api, extractApiErrorMessage } from '../lib/api';
import { syncGitHubConnectionDoc } from '../lib/firebase';
import type { GitHubConnectionState, GitHubRepoSummary } from '../types/codevity';

export function GitHubConnectionPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState<GitHubConnectionState | null>(null);
  const [repos, setRepos] = useState<GitHubRepoSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchRepositories = useCallback(async () => {
    setLoadingRepos(true);
    try {
      const res = await api.get<{ repositories: GitHubRepoSummary[] }>('/github/repositories');
      setRepos(res.data.repositories);
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Failed to fetch GitHub repositories.'));
    } finally {
      setLoadingRepos(false);
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get<GitHubConnectionState>('/github/status');
      setStatus(res.data);
      try {
        await syncGitHubConnectionDoc(user.uid, res.data);
      } catch {
        // Non-blocking Firestore sync
      }
      if (res.data.connected) {
        await fetchRepositories();
      } else {
        setRepos([]);
      }
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Failed to check GitHub connection status.'));
    } finally {
      setLoading(false);
    }
  }, [user, fetchRepositories]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (
        !origin.endsWith('.run.app') &&
        !origin.includes('localhost') &&
        origin !== window.location.origin
      ) {
        return;
      }

      if (event.data?.type === 'GITHUB_OAUTH_SUCCESS') {
        setConnecting(false);
        setSuccessMsg(`Connected GitHub account @${event.data.githubUsername}.`);
        void refreshStatus();
      } else if (event.data?.type === 'GITHUB_OAUTH_ERROR') {
        setConnecting(false);
        setError(event.data.error || 'GitHub authorization failed.');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [refreshStatus]);

  const handleConnect = async () => {
    setError('');
    setSuccessMsg('');
    setConnecting(true);
    try {
      const res = await api.get<{ configured: boolean; url?: string; error?: string }>(
        '/github/auth-url',
        { params: { origin: window.location.origin } }
      );
      if (!res.data.configured || !res.data.url) {
        setConnecting(false);
        setError(res.data.error || 'GitHub OAuth is not configured on the server.');
        return;
      }

      const popup = window.open(
        res.data.url,
        'github_oauth',
        'width=640,height=720,scrollbars=yes'
      );
      if (!popup) {
        setConnecting(false);
        setError('Popup was blocked by the browser. Please allow popups for this site and try again.');
        return;
      }

      const closeCheck = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(closeCheck);
          setConnecting(false);
        }
      }, 500);
    } catch (err) {
      setConnecting(false);
      setError(extractApiErrorMessage(err, 'Could not start GitHub OAuth flow.'));
    }
  };

  const handleDisconnect = async () => {
    if (!user) return;
    setError('');
    setSuccessMsg('');
    try {
      await api.post('/github/disconnect');
      const disconnectedState: GitHubConnectionState = {
        configured: Boolean(status?.configured),
        connected: false,
        githubUsername: '',
        avatarUrl: '',
        scopes: '',
        tokenRef: '',
        callbackUrl: status?.callbackUrl || '',
      };
      setStatus(disconnectedState);
      setRepos([]);
      await syncGitHubConnectionDoc(user.uid, disconnectedState);
      setSuccessMsg('GitHub account disconnected.');
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Failed to disconnect GitHub account.'));
    }
  };

  const runtimeCallbackUrl = `${window.location.origin}/auth/github/callback`;

  return (
    <DashboardLayout breadcrumb="GitHub Connection">
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            GitHub Account Connection
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Connect your GitHub account via OAuth to browse repositories and analyse private
            repositories. Public repositories can be analysed anytime.
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-sm text-rose-800">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Connection Card */}
        <section className="bg-white border border-slate-200 rounded-xl p-6">
          {loading ? (
            <div className="h-20 bg-slate-100 rounded animate-pulse" />
          ) : !status?.configured ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-display text-base font-semibold text-slate-900">
                    GitHub OAuth Credentials Not Configured
                  </h2>
                  <p className="text-sm text-slate-600 mt-1">
                    Server environment variables <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">GITHUB_CLIENT_ID</code> and{' '}
                    <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">GITHUB_CLIENT_SECRET</code> are not set yet.
                    You can still analyse any public GitHub repository URL immediately on the Analyse page.
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-700 space-y-2">
                <p className="font-medium text-slate-900">To enable GitHub OAuth for private repositories:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-xs sm:text-sm">
                  <li>
                    Open{' '}
                    <a
                      href="https://github.com/settings/developers"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline"
                    >
                      GitHub Developer Settings → OAuth Apps
                    </a>
                    .
                  </li>
                  <li>
                    Set the Authorization callback URL to:{' '}
                    <code className="font-mono text-xs bg-white border border-slate-200 px-2 py-0.5 rounded select-all">
                      {runtimeCallbackUrl}
                    </code>
                  </li>
                  <li>
                    Add <code className="font-mono text-xs">GITHUB_CLIENT_ID</code> and{' '}
                    <code className="font-mono text-xs">GITHUB_CLIENT_SECRET</code> to your environment secrets and restart the server.
                  </li>
                </ol>
              </div>
            </div>
          ) : status.connected ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                {status.avatarUrl ? (
                  <img
                    src={status.avatarUrl}
                    alt={status.githubUsername}
                    referrerPolicy="no-referrer"
                    className="h-12 w-12 rounded-full border border-slate-200 object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center">
                    <GitBranch className="h-5 w-5" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-lg font-semibold text-slate-900">
                      @{status.githubUsername}
                    </h2>
                    <span className="text-xs font-medium text-emerald-700">Connected</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Granted scopes: {status.scopes || 'read:user, repo'} · Token encrypted in server vault
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void fetchRepositories()}
                  disabled={loadingRepos}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingRepos ? 'animate-spin' : ''}`} />
                  <span>Refresh Repos</span>
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer"
                >
                  <Unlink className="h-4 w-4" />
                  <span>Disconnect</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Connect Your GitHub Account
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Authorise Codevity via GitHub OAuth to list your repositories and analyse
                  private repositories securely.
                </p>
              </div>

              <button
                type="button"
                onClick={handleConnect}
                disabled={connecting}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <GitBranch className="h-4 w-4" />
                <span>{connecting ? 'Authorising...' : 'Connect GitHub'}</span>
              </button>
            </div>
          )}
        </section>

        {/* Connected User Repositories */}
        {status?.connected && (
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Your GitHub Repositories
                </h2>
                <p className="text-xs text-slate-500">
                  Includes public and authorised private repositories
                </p>
              </div>
              <span className="text-xs font-mono text-slate-500 tabular-nums">
                {repos.length} repositories
              </span>
            </div>

            {loadingRepos ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
                ))}
              </div>
            ) : repos.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No repositories found for this GitHub account.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {repos.map((repo) => (
                  <div
                    key={repo.id}
                    className="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50/70"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900 truncate">
                          {repo.fullName}
                        </span>
                        {repo.isPrivate && (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                            <Lock className="h-3 w-3" />
                            <span>Private</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {repo.description || 'No description'} · {repo.language} · Updated{' '}
                        {new Date(repo.updatedAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <a
                        href={repo.htmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                        title="Open on GitHub"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`/analyze?url=${encodeURIComponent(repo.htmlUrl)}`)
                        }
                        className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors cursor-pointer"
                      >
                        Analyse
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}
