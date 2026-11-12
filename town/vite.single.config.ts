import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

/** 单文件构建：把整个前端打成一个 HTML，用于在线预览分享 */
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: { outDir: 'dist-single', chunkSizeWarningLimit: 5000 },
});
