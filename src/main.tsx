import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppErrorBoundary } from './AppErrorBoundary.tsx';
import { ToastProvider } from './context/ToastContext.tsx';
import { repairCorruptedLocalStorage } from './safeStorage.ts';
import { Root } from './Root.tsx';
import './index.css';

repairCorruptedLocalStorage();

const rootEl = document.getElementById('root');
if (!rootEl) {
  console.error('[App] #root element missing — cannot mount React');
} else {
  createRoot(rootEl).render(
    <StrictMode>
      <AppErrorBoundary>
        <ToastProvider>
          <Root />
        </ToastProvider>
      </AppErrorBoundary>
    </StrictMode>
  );
}
