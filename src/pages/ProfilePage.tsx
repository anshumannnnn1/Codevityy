import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { sendEmailVerification } from 'firebase/auth';
import { AlertCircle, CheckCircle2, GitBranch, LogOut, Mail, User } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { auth } from '../lib/firebase';
import type { GitHubConnectionState } from '../types/codevity';

export function ProfilePage() {
  const { user, profile, updateDisplayName, logout } = useAuth();
  const navigate = useNavigate();

  const [nameInput, setNameInput] = useState(profile?.name || user?.displayName || '');
  const [ghStatus, setGhStatus] = useState<GitHubConnectionState | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setNameInput(profile?.name || user?.displayName || '');
  }, [profile, user]);

  useEffect(() => {
    let cancelled = false;
    api
      .get<GitHubConnectionState>('/github/status')
      .then((res) => {
        if (!cancelled) setGhStatus(res.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (nameInput.trim().length < 2 || nameInput.trim().length > 100) {
      setError('Display name must be between 2 and 100 characters.');
      return;
    }

    setSaving(true);
    try {
      await updateDisplayName(nameInput);
      setMessage('Profile name updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleSendVerification = async () => {
    if (!auth.currentUser) return;
    setError('');
    setMessage('');
    try {
      await sendEmailVerification(auth.currentUser);
      setMessage('Verification email sent. Please check your inbox.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send verification email.');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <DashboardLayout breadcrumb="Profile">
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            Account Profile
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage your Codevity profile details, GitHub connection status, and session.
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-sm text-rose-800">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{message}</span>
          </div>
        )}

        {/* User Details Form */}
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <form onSubmit={handleSaveName} className="space-y-4">
            <div>
              <label htmlFor="profile-name" className="block text-sm font-medium text-slate-700 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="profile-name"
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Email Address
              </label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="relative flex-1">
                  <Mail className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    readOnly
                    value={profile?.email || user?.email || ''}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-600"
                  />
                </div>
                {user && !user.emailVerified && (
                  <button
                    type="button"
                    onClick={handleSendVerification}
                    className="px-3.5 py-2 rounded-lg text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 whitespace-nowrap cursor-pointer"
                  >
                    Verify Email
                  </button>
                )}
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Member since{' '}
                {profile?.createdAt
                  ? new Date(profile.createdAt).toLocaleDateString()
                  : 'Today'}
              </span>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 transition-colors cursor-pointer"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </section>

        {/* GitHub Status */}
        <section className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <GitBranch className="h-5 w-5 text-indigo-600" />
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                GitHub Connection Status
              </h2>
              <p className="text-sm text-slate-600">
                {ghStatus?.connected
                  ? `Connected as @${ghStatus.githubUsername}`
                  : 'Not connected via GitHub OAuth'}
              </p>
            </div>
          </div>

          <Link
            to="/github"
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors whitespace-nowrap self-start"
          >
            Manage Connection
          </Link>
        </section>

        {/* Session Logout */}
        <section className="bg-white border border-slate-200 rounded-xl p-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Sign Out
            </h2>
            <p className="text-sm text-slate-600">
              End your current Codevity session on this device.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Log Out</span>
          </button>
        </section>
      </div>
    </DashboardLayout>
  );
}
