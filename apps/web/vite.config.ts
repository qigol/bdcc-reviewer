import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8080' },
  },
  worker: {
    format: 'es',
    // self-contained workers with stable names: the server's CSP for logic.worker-*.js allows no script URLs
    rollupOptions: { output: { inlineDynamicImports: true, entryFileNames: 'assets/[name]-[hash].js' } },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          katex: ['katex'],
          motion: ['framer-motion'],
          markdown: ['react-markdown', 'remark-gfm', 'remark-math', 'rehype-katex'],
        },
      },
    },
  },
});
