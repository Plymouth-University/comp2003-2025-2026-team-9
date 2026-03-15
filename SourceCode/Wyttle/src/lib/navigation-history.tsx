import { useGlobalSearchParams, usePathname, useRouter, type Href } from 'expo-router';
import type { PropsWithChildren } from 'react';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type NavigationHistoryContextValue = {
  history: string[];
  /**
   * Smart back behaviour for in-app navigation:
   * - Walks backwards through the recorded history.
   * - Skips auth routes ("/(auth)/...") and the landing index ("/").
   * - Navigates to the most recent non-auth path, if any.
   * - Returns `true` if navigation occurred, otherwise `false`.
   */
  goBackSmart: () => boolean;
  /**
   * Hard-resets the recorded history to a single entry. This is useful
   * on logout, so that back navigation from auth screens cannot jump
   * into stale in-app routes.
   */
  resetHistory: (initialPath: string) => void;
};

const NavigationHistoryContext = createContext<NavigationHistoryContextValue | undefined>(
  undefined,
);

function getBasePath(route: string): string {
  return route.split('?')[0] ?? route;
}

function isAuthOrRoot(route: string): boolean {
  const path = getBasePath(route);
  return path === '/' || path.startsWith('/(auth)/');
}

function buildRouteKey(
  pathname: string,
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const params = new URLSearchParams();

  Object.entries(searchParams)
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([key, value]) => {
      if (typeof value === 'string') {
        params.append(key, value);
        return;
      }

      if (Array.isArray(value)) {
        value.forEach((entry) => params.append(key, entry));
      }
    });

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function NavigationHistoryProvider({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const searchParams = useGlobalSearchParams();
  const router = useRouter();
  const routeKey = useMemo(
    () => buildRouteKey(pathname, searchParams),
    [pathname, searchParams],
  );
  const [history, setHistory] = useState<string[]>([routeKey]);

  // Record every distinct route transition, including query params.
  useEffect(() => {
    setHistory((prev) => {
      if (prev[prev.length - 1] === routeKey) return prev;
      return [...prev, routeKey];
    });
  }, [routeKey]);

  const goBackSmart = useCallback((): boolean => {
    if (history.length <= 1) return false;

    const current = history[history.length - 1];
    let idx = history.length - 2;
    let target: string | null = null;

    // Walk backwards, skipping auth/root entries.
    for (; idx >= 0; idx--) {
      const candidate = history[idx];
      if (candidate === current) continue;
      if (isAuthOrRoot(candidate)) continue;
      target = candidate;
      break;
    }

    if (!target || target === current) {
      // No suitable previous app route – nothing to do.
      return false;
    }

    router.replace(target as Href);
    // Truncate history to the target so repeated back presses keep walking back.
    setHistory(history.slice(0, idx + 1));
    return true;
  }, [history, router]);

  const resetHistory = useCallback((initialPath: string) => {
    setHistory([initialPath]);
  }, []);

  const value = useMemo(
    () => ({ history, goBackSmart, resetHistory }),
    [history, goBackSmart, resetHistory],
  );

  return (
    <NavigationHistoryContext.Provider value={value}>
      {children}
    </NavigationHistoryContext.Provider>
  );
}

export function useNavigationHistory(): NavigationHistoryContextValue {
  const ctx = useContext(NavigationHistoryContext);
  if (!ctx) {
    throw new Error('useNavigationHistory must be used within a NavigationHistoryProvider');
  }
  return ctx;
}
