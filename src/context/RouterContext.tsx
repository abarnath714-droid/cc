import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface RouterContextValue {
  path: string;
  search: string;
  navigate: (to: string) => void;
}

const RouterContext = createContext<RouterContextValue | null>(null);

function normalizePath(raw: string): string {
  const pathOnly = raw.split('?')[0] || '/';
  if (!pathOnly || pathOnly === '/') return '/';
  return pathOnly.endsWith('/') && pathOnly.length > 1 ? pathOnly.slice(0, -1) : pathOnly;
}

function extractSearch(raw: string): string {
  const qIndex = raw.indexOf('?');
  return qIndex >= 0 ? raw.slice(qIndex) : '';
}

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [path, setPath] = useState<string>(() => normalizePath(window.location.pathname));
  const [search, setSearch] = useState<string>(() => window.location.search);

  useEffect(() => {
    const onPopState = () => {
      setPath(normalizePath(window.location.pathname));
      setSearch(window.location.search);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((to: string) => {
    const nextPath = normalizePath(to);
    const nextSearch = extractSearch(to);
    const fullTarget = `${nextPath}${nextSearch}`;
    const currentFull = `${normalizePath(window.location.pathname)}${window.location.search}`;
    if (fullTarget !== currentFull) {
      window.history.pushState({}, '', fullTarget);
    }
    setPath(nextPath);
    setSearch(nextSearch);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <RouterContext.Provider value={{ path, search, navigate }}>{children}</RouterContext.Provider>
  );
}

export function useRouter() {
  const ctx = useContext(RouterContext);
  if (!ctx) {
    throw new Error('useRouter must be used inside RouterProvider');
  }
  return ctx;
}
