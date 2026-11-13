import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  // 开发时把 /api 转发到本地后端（npm run server，默认 8787 端口）
  server: { port: 5180, host: true, proxy: { '/api': 'http://localhost:8787' } },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: { input: { main: resolve(import.meta.dirname, 'index.html'), admin: resolve(import.meta.dirname, 'admin.html') } },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'server/test/**/*.test.ts'], testTimeout: 30000 },
} as any);
