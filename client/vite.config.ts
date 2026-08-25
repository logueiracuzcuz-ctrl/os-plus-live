import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, 'src/renderer'),
  envDir: __dirname,
  // Electron loads the renderer from the filesystem; Vercel serves it from a URL.
  base: process.env.VERCEL ? '/' : './',
  build: {
    outDir: path.resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
      '@screenshare/shared': path.resolve(__dirname, '..', 'shared', 'src', 'index.ts'),
    },
  },
});
