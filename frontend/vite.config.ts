import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', // آدرس روت برای SPA بعد از build
  build: {
    outDir: '../public', // خروجی تولیدی بره تو public/panel لاراول
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000', // همون جایی که لاراول ران می‌شه
        changeOrigin: true,
      },
    },
  },
});