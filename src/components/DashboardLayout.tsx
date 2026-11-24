import React, { useState } from 'react';
import {
  ChevronRight,
  ExternalLink,
  LogOut,
  Menu,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useRouter } from '../context/RouterContext.tsx';

export interface SidebarNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badgeCount?: number;
}

export function DashboardLayout({
  portalLabel,
  title,
  navItems,
  activeSection,
  onSelectSection,
  primaryAction,
  children,
}: {
  portalLabel: string;
  title: string;
  navItems: SidebarNavItem[];
  activeSection: string;
  onSelectSection: (id: string) => void;
  primaryAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const { navigate } = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await logout();
    navigate('/login');
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#FFFFFF] border-r border-[#E2DDD1]">
      <div className="px-6 h-16 flex items-center justify-between border-b border-[#E2DDD1]">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="font-display text-xl font-bold tracking-tight text-[#166534] whitespace-nowrap cursor-pointer"
        >
          HarvestBridge
        </button>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
          className="lg:hidden p-2 rounded-lg text-[#4B5D51] hover:bg-[#FAF7F0] min-h-[40px] min-w-[40px]"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Signed-in user context */}
      <div className="px-5 py-4 border-b border-[#E2DDD1] bg-[#FAF7F0]/60">
        <p className="text-xs font-medium text-[#166534]">{portalLabel}</p>
        <p className="text-sm font-semibold text-[#142219] truncate mt-0.5">
          {user?.organizationName || user?.name}
        </p>
        <p className="text-xs text-[#4B5D51] truncate">{user?.email}</p>
      </div>

      {/* Dashboard Navigation */}
      <nav aria-label="Dashboard navigation" className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectSection(item.id);
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-[42px] cursor-pointer ${
                isActive
                  ? 'bg-[#E9F0EA] text-[#166534]'
                  : 'text-[#4B5D51] hover:bg-[#FAF7F0] hover:text-[#142219]'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </span>
              {typeof item.badgeCount === 'number' && item.badgeCount > 0 && (
                <span className="font-mono text-xs tabular-nums rounded-md bg-[#166534] text-white px-2 py-0.5 shrink-0">
                  {item.badgeCount}
                </span>
              )}
            </button>
          );
        })}

        <div className="pt-4 mt-4 border-t border-[#E2DDD1] space-y-1">
          <p className="px-3 pb-1 text-xs font-medium text-[#4B5D51]">Public Pages</p>
          <button
            type="button"
            onClick={() => navigate('/available-food')}
            className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm text-[#4B5D51] hover:bg-[#FAF7F0] hover:text-[#142219] min-h-[40px] cursor-pointer"
          >
            <span>Browse Available Food</span>
            <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm text-[#4B5D51] hover:bg-[#FAF7F0] hover:text-[#142219] min-h-[40px] cursor-pointer"
          >
            <span>Home Page</span>
            <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => navigate('/contact')}
            className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm text-[#4B5D51] hover:bg-[#FAF7F0] hover:text-[#142219] min-h-[40px] cursor-pointer"
          >
            <span>Contact Support</span>
            <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          </button>
        </div>
      </nav>

      {/* Sign out */}
      <div className="p-4 border-t border-[#E2DDD1]">
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-[#E2DDD1] bg-[#FAF7F0] px-4 py-2.5 text-sm font-medium text-[#142219] hover:bg-[#F2EDE1] transition-colors min-h-[42px] cursor-pointer"
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#FAF7F0] text-[#142219]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-[264px] shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#142219]/40"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-[272px] max-w-[85vw] h-full z-10">{sidebarContent}</aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-16 bg-[#FFFFFF]/95 backdrop-blur-sm border-b border-[#E2DDD1] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar navigation"
              className="lg:hidden inline-flex items-center justify-center rounded-lg border border-[#E2DDD1] bg-[#FAF7F0] p-2 text-[#142219] min-h-[44px] min-w-[44px] cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden sm:inline text-[#4B5D51] whitespace-nowrap">{portalLabel}</span>
              <ChevronRight className="hidden sm:inline w-4 h-4 text-[#4B5D51] shrink-0" aria-hidden="true" />
              <h1 className="font-display text-lg font-semibold text-[#142219] truncate">{title}</h1>
            </div>
          </div>

          {primaryAction && <div className="shrink-0">{primaryAction}</div>}
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
