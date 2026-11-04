import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/ws': { target: 'ws://localhost:5178', ws: true },
      '/api': { target: 'http://localhost:5178' },
    },
  },
});
