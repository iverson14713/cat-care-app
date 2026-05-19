import { createContext, useContext, type ReactNode } from 'react';
import type { AppBootstrapResult } from './appBootstrap';

const AppBootstrapContext = createContext<AppBootstrapResult | null>(null);

export function AppBootstrapProvider({
  value,
  children,
}: {
  value: AppBootstrapResult;
  children: ReactNode;
}) {
  return <AppBootstrapContext.Provider value={value}>{children}</AppBootstrapContext.Provider>;
}

export function useAppBootstrap(): AppBootstrapResult {
  const ctx = useContext(AppBootstrapContext);
  if (!ctx) {
    throw new Error('useAppBootstrap must be used within AppBootstrapProvider');
  }
  return ctx;
}
