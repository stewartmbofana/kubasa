import React, { useState, useEffect } from 'react';
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  Link,
  useNavigate,
  RouterProvider,
} from '@tanstack/react-router';
import { useAuthStatus, AuthContext, useAuth } from './context/AuthContext';
import { registerToastSetter } from './utils/toast';
import { Toast } from './types';

// Page components imports
import Home from './pages/Home';
import CandidateRegister from './pages/candidates/Register';
import CandidateLogin from './pages/candidates/Login';
import CandidateProfile from './pages/candidates/Profile';
import CandidateJobs from './pages/candidates/Jobs';
import EmployerRegister from './pages/employers/Register';
import EmployerLogin from './pages/employers/Login';
import EmployerCandidates from './pages/employers/Candidates';
import EmployerShortlist from './pages/employers/Shortlist';
import EmployerJobs from './pages/employers/Jobs';
import EmployerJobsNew from './pages/employers/JobsNew';
import AdminLogin from './pages/admin/Login';
import AdminDashboard from './pages/admin/Dashboard';

// ================================================================
// Layout Template (Root Route)
// ================================================================
const rootRoute = createRootRoute({
  component: () => {
    const { currentUser, userDoc, loading } = useAuth();
    const navigate = useNavigate();
    const [toasts, setToasts] = useState<Toast[]>([]);

    useEffect(() => {
      registerToastSetter((message, type = 'success') => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 4000);
      });
    }, []);

    const handleSignOut = async () => {
      const { auth } = await import('./firebase');
      const { showToast } = await import('./utils/toast');
      await auth.signOut();
      showToast('Signed out successfully');
      navigate({ to: '/' });
    };

    const getInitials = () => {
      if (!currentUser) return '?';
      return (currentUser.displayName || currentUser.email || 'U').charAt(0).toUpperCase();
    };

    return (
      <div className="flex flex-col min-h-screen">
        {/* Navbar */}
        <nav className="navbar" role="navigation" aria-label="Main navigation">
          <div className="container">
            <div className="navbar__inner">
              <Link to="/" className="navbar__brand">
                <div className="navbar__brand-icon">K</div>
                Kubasa
              </Link>

              {/* Navigation Links */}
              <div className="navbar__nav">
                {!currentUser && (
                  <>
                    <Link to="/candidates/login" className="navbar__link">For Candidates</Link>
                    <Link to="/employers/login" className="navbar__link">For Employers</Link>
                    <Link to="/admin/login" className="navbar__link" style={{ fontSize: '0.82rem', opacity: 0.6 }}>Admin</Link>
                  </>
                )}
                {currentUser && userDoc && (
                  <>
                    {userDoc.role === 'candidate' && (
                      <>
                        <Link to="/candidates/profile" className="navbar__link">My Profile</Link>
                        <Link to="/candidates/jobs" className="navbar__link">Browse Jobs</Link>
                      </>
                    )}
                    {userDoc.role === 'employer' && (
                      <>
                        <Link to="/employers/candidates" className="navbar__link">Candidates</Link>
                        <Link to="/employers/shortlist" className="navbar__link">Shortlist</Link>
                        <Link to="/employers/jobs" className="navbar__link">My Jobs</Link>
                      </>
                    )}
                    {userDoc.role === 'admin' && (
                      <Link to="/admin/dashboard" className="navbar__link">Dashboard</Link>
                    )}
                  </>
                )}
              </div>

              {/* Actions / User Profile */}
              <div className="navbar__actions" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                {!currentUser ? (
                  <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                    <Link to="/candidates/register" className="btn btn--outline btn--sm">Join as Candidate</Link>
                    <Link to="/employers/register" className="btn btn--accent btn--sm">Post Jobs</Link>
                  </div>
                ) : (
                  <>
                    <div className="navbar__user-chip">
                      <div className="navbar__avatar">{getInitials()}</div>
                      <span>{currentUser.displayName || currentUser.email?.split('@')[0]}</span>
                    </div>
                    <button onClick={handleSignOut} className="btn btn--ghost btn--sm">Sign out</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </nav>

        {/* Page Content */}
        <main style={{ flex: 1 }}>
          {loading ? (
            <div className="page-loader">
              <div className="spinner"></div>
              <p>Authenticating...</p>
            </div>
          ) : (
            <Outlet />
          )}
        </main>

        {/* Toast Container */}
        <div className="toast-container" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast--${t.type}`}>
              <span className="toast__icon">
                {t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : '⚠️'}
              </span>
              <span className="toast__message">{t.message}</span>
            </div>
          ))}
        </div>
      </div>
    );
  },
});

// ================================================================
// Route Declarations
// ================================================================
const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Home,
});

const candidateRegisterRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/candidates/register',
  component: CandidateRegister,
});

const candidateLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/candidates/login',
  component: CandidateLogin,
});

const candidateProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/candidates/profile',
  component: CandidateProfile,
});

const candidateJobsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/candidates/jobs',
  component: CandidateJobs,
});

const employerRegisterRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/employers/register',
  component: EmployerRegister,
});

const employerLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/employers/login',
  component: EmployerLogin,
});

const employerCandidatesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/employers/candidates',
  component: EmployerCandidates,
});

const employerShortlistRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/employers/shortlist',
  component: EmployerShortlist,
});

const employerJobsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/employers/jobs',
  component: EmployerJobs,
});

const employerJobsNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/employers/jobs/new',
  component: EmployerJobsNew,
});

const adminLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/login',
  component: AdminLogin,
});

const adminDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/dashboard',
  component: AdminDashboard,
});

// ================================================================
// Router Definition
// ================================================================
const routeTree = rootRoute.addChildren([
  homeRoute,
  candidateRegisterRoute,
  candidateLoginRoute,
  candidateProfileRoute,
  candidateJobsRoute,
  employerRegisterRoute,
  employerLoginRoute,
  employerCandidatesRoute,
  employerShortlistRoute,
  employerJobsRoute,
  employerJobsNewRoute,
  adminLoginRoute,
  adminDashboardRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export function AppRouter() {
  const authStatus = useAuthStatus();
  return (
    <AuthContext.Provider value={authStatus}>
      <RouterProvider router={router} />
    </AuthContext.Provider>
  );
}
