import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useRouter } from '../context/RouterContext.tsx';

export function getDashboardPath(role: string): string {
  if (role === 'admin') return '/admin';
  if (role === 'ngo') return '/ngo';
  return '/donor';
}

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const { path, navigate } = useRouter();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { label: 'Home', to: '/' },
    { label: 'Available Food', to: '/available-food' },
    { label: 'About Us', to: '/about' },
    { label: 'Contact Us', to: '/contact' },
  ];

  const handleNav = (to: string) => {
    setMobileOpen(false);
    navigate(to);
  };

  const primaryHref = user ? getDashboardPath(user.role) : '/login';
  const primaryLabel = user ? 'Dashboard' : 'Sign In';

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F0] text-[#142219]">
      {/* Top Bar: Strict 3-Zone Contract */}
      <header className="sticky top-0 z-40 bg-[#FFFFFF]/95 backdrop-blur-sm border-b border-[#E2DDD1]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => handleNav('/')}
            className="font-display text-xl font-bold tracking-tight text-[#166534] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#166534]"
          >
            HarvestBridge
          </button>

          {/* Zone 2: 4 single-line text nav links */}
          <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-7">
            {navLinks.map((item) => {
              const isActive =
                path === item.to ||
                (item.to === '/available-food' && path.startsWith('/donations/'));
              return (
                <button
                  key={item.to}
                  type="button"
                  onClick={() => handleNav(item.to)}
                  className={`text-sm font-medium whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
                    isActive
                      ? 'text-[#166534] border-[#166534]'
                      : 'text-[#4B5D51] border-transparent hover:text-[#142219] hover:border-[#D6E0D8]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 primary action + mobile menu button */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => handleNav(primaryHref)}
              className="hidden md:inline-flex items-center justify-center rounded-lg bg-[#166534] px-4 py-2 text-sm font-medium text-white hover:bg-[#14532D] transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[40px]"
            >
              {primaryLabel}
            </button>

            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileOpen}
              className="md:hidden inline-flex items-center justify-center rounded-lg border border-[#E2DDD1] bg-[#FAF7F0] p-2.5 text-[#142219] hover:bg-[#F2EDE1] min-h-[44px] min-w-[44px] cursor-pointer"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <div className="md:hidden border-t border-[#E2DDD1] bg-[#FFFFFF] px-4 py-4 space-y-2">
            {navLinks.map((item) => (
              <button
                key={item.to}
                type="button"
                onClick={() => handleNav(item.to)}
                className={`block w-full text-left rounded-lg px-3 py-2.5 text-sm font-medium min-h-[44px] ${
                  path === item.to
                    ? 'bg-[#E9F0EA] text-[#166534]'
                    : 'text-[#4B5D51] hover:bg-[#FAF7F0]'
                }`}
              >
                {item.label}
              </button>
            ))}
            <div className="pt-2 border-t border-[#E2DDD1] flex flex-col gap-2">
              <button
                type="button"
                onClick={() => handleNav(primaryHref)}
                className="w-full rounded-lg bg-[#166534] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#14532D] min-h-[44px]"
              >
                {primaryLabel}
              </button>
              {!user && (
                <button
                  type="button"
                  onClick={() => handleNav('/register')}
                  className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-4 py-2.5 text-sm font-medium text-[#142219] hover:bg-[#F2EDE1] min-h-[44px]"
                >
                  Create Account
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-[#E2DDD1] bg-[#FFFFFF] text-[#4B5D51]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <button
              type="button"
              onClick={() => handleNav('/')}
              className="font-display text-lg font-bold text-[#166534] cursor-pointer"
            >
              HarvestBridge
            </button>
            <p className="text-sm text-[#4B5D51] mt-1">
              Connecting surplus food donors with community NGOs to eliminate waste.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-sm font-medium">
            <button
              type="button"
              onClick={() => handleNav('/')}
              className="hover:text-[#166534] transition-colors cursor-pointer"
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => handleNav('/available-food')}
              className="hover:text-[#166534] transition-colors cursor-pointer"
            >
              Available Food
            </button>
            <button
              type="button"
              onClick={() => handleNav('/about')}
              className="hover:text-[#166534] transition-colors cursor-pointer"
            >
              About Us
            </button>
            <button
              type="button"
              onClick={() => handleNav('/contact')}
              className="hover:text-[#166534] transition-colors cursor-pointer"
            >
              Contact Us
            </button>
            {!user && (
              <button
                type="button"
                onClick={() => handleNav('/register')}
                className="hover:text-[#166534] transition-colors cursor-pointer"
              >
                Register
              </button>
            )}
          </div>
        </div>
        <div className="border-t border-[#E2DDD1] bg-[#FAF7F0]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#4B5D51]">
            <span>&copy; {new Date().getFullYear()} HarvestBridge Food Donation Management System</span>
            <span>Donor · NGO · Community Coordination</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
