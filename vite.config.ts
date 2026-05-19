import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const assistantTarget = env.ASSISTANT_SERVER_URL || 'http://127.0.0.1:8788';

  return {
    plugins: [react()],
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    server: {
      proxy: {
        '/api': {
          target: assistantTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
