import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AppErrorBoundary } from './AppErrorBoundary.tsx';
import { repairCorruptedLocalStorage } from './safeStorage.ts';
import './index.css';

repairCorruptedLocalStorage();

const rootEl = document.getElementById('root');
if (!rootEl) {
  console.error('[App] #root element missing — cannot mount React');
} else {
  createRoot(rootEl).render(
    <StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </StrictMode>
  );
}
