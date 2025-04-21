import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // Alias wallet package
      '@coin/wallet': path.resolve(__dirname, 'packages/wallet/src')
    }
  },
  test: {
    environment: 'node'
  }
});