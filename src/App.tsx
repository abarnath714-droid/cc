import React, { useEffect } from 'react';
import { PublicLayout, getDashboardPath } from './components/PublicLayout.tsx';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { RouterProvider, useRouter } from './context/RouterContext.tsx';
import { ToastProvider } from './context/ToastContext.tsx';
import { AboutPage } from './pages/AboutPage.tsx';
import { AdminDashboardPage } from './pages/AdminDashboardPage.tsx';
import { AvailableFoodPage } from './pages/AvailableFoodPage.tsx';
import { ContactPage } from './pages/ContactPage.tsx';
import { DonationDetailsPage } from './pages/DonationDetailsPage.tsx';
import { DonorDashboardPage } from './pages/DonorDashboardPage.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { NgoDashboardPage } from './pages/NgoDashboardPage.tsx';
import { RegisterPage } from './pages/RegisterPage.tsx';
import type { UserRole } from './types.ts';

function RoleGuard({
  allowedRole,
  children,
}: {
  allowedRole: UserRole;
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const { navigate } = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/login');
    } else if (user.role !== allowedRole) {
      navigate(getDashboardPath(user.role));
    }
  }, [user, loading, allowedRole, navigate]);

  if (loading || !user || user.role !== allowedRole) {
    return (
      <PublicLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center text-sm text-[#4B5D51]">
          Verifying workspace access...
        </div>
      </PublicLayout>
    );
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { path, navigate } = useRouter();

  if (path === '/') {
    return <HomePage />;
  }
  if (path === '/about') {
    return <AboutPage />;
  }
  if (path === '/available-food') {
    return <AvailableFoodPage />;
  }
  if (path === '/contact') {
    return <ContactPage />;
  }
  if (path === '/login') {
    return <LoginPage />;
  }
  if (path === '/register') {
    return <RegisterPage />;
  }
  if (path === '/donor') {
    return (
      <RoleGuard allowedRole="donor">
        <DonorDashboardPage />
      </RoleGuard>
    );
  }
  if (path === '/ngo') {
    return (
      <RoleGuard allowedRole="ngo">
        <NgoDashboardPage />
      </RoleGuard>
    );
  }
  if (path === '/admin') {
    return (
      <RoleGuard allowedRole="admin">
        <AdminDashboardPage />
      </RoleGuard>
    );
  }

  const donationMatch = /^\/donations\/(\d+)$/.exec(path);
  if (donationMatch) {
    const donationId = Number(donationMatch[1]);
    return <DonationDetailsPage donationId={donationId} />;
  }

  return (
    <PublicLayout>
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="font-display text-3xl font-bold text-[#142219]">Page Not Found</h1>
        <p className="text-sm text-[#4B5D51]">
          The page you requested could not be found in HarvestBridge.
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="rounded-lg bg-[#166534] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#14532D] cursor-pointer"
        >
          Return Home
        </button>
      </div>
    </PublicLayout>
  );
}

export default function App() {
  return (
    <RouterProvider>
      <ToastProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ToastProvider>
    </RouterProvider>
  );
}
