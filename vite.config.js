import { defineConfig } from 'vite';

export default defineConfig({
  server: { proxy: { '/api': process.env.CIVIC_SERVER_URL || 'http://127.0.0.1:8787' } },
  build: { rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } } },
});

