import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: '/antibankcrypto/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        whitepaper: resolve(root, 'whitepaper.html'),
        howItWorks: resolve(root, 'how-it-works.html')
      }
    }
  }
});
