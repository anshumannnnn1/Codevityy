import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  FileText,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface DashboardLayoutProps {
  breadcrumb: string;
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/analyze', label: 'Analyse Repository', icon: Search },
  { to: '/reports', label: 'My Reports', icon: FileText },
  { to: '/github', label: 'GitHub Connection', icon: GitBranch },
  { to: '/profile', label: 'Profile', icon: User },
];

export function DashboardLayout({ breadcrumb, children }: DashboardLayoutProps) {
  const { profile, user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const displayName = profile?.name || user?.displayName || 'Developer';
  const email = profile?.email || user?.email || '';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-slate-200">
        <div className="h-16 px-6 flex items-center border-b border-slate-200">
          <Link
            to="/dashboard"
            className="flex items-center gap-2.5 font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap"
          >
            <span className="h-7 w-7 rounded-md bg-indigo-600 text-white flex items-center justify-center">
              <BarChart3 className="h-4 w-4" />
            </span>
            <span>Codevity</span>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200">
          <div className="mb-3 px-1">
            <p className="text-sm font-medium text-slate-900 truncate">{displayName}</p>
            <p className="text-xs text-slate-500 truncate">{email}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-64 max-w-full bg-white border-r border-slate-200 flex flex-col z-50">
            <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200">
              <Link
                to="/dashboard"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 font-display text-lg font-bold text-slate-900"
              >
                <span className="h-7 w-7 rounded-md bg-indigo-600 text-white flex items-center justify-center">
                  <BarChart3 className="h-4 w-4" />
                </span>
                <span>Codevity</span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation menu"
                className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-200">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-500 truncate">
              <span>Codevity</span>
              <span aria-hidden="true">/</span>
              <span className="font-medium text-slate-900 truncate">{breadcrumb}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/analyze"
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors whitespace-nowrap shrink-0"
            >
              Analyse Repository
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
