import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';

/** Which build played a game: the commit when git is there (local builds), else the build time. */
function version(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return new Date().toISOString().slice(0, 16).replace(/[-:]/g, '');
  }
}

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(version()) },
  base: './',
});
