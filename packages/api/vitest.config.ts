import { defineConfig } from 'vitest/config';
import path from 'path';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load test environment variables
  const env = loadEnv('test', process.cwd(), '');

  return {
    test: {
      environment: 'node',
      globals: true,
      include: ['src/**/*.{test,spec}.{js,ts}'],
      exclude: ['node_modules', 'dist'],
      testTimeout: 10000,
      env: {
        NODE_ENV: 'test',
        ...env
      },
      setupFiles: ['./vitest.setup.ts']
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    define: {
      'process.env': JSON.stringify({
        NODE_ENV: 'test',
        RPC_URL: 'mock://localhost:8545',
        PREDICTION_MARKET_ADDRESS: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
        CHAIN_ID: '31337',
        START_BLOCK: '0',
        PORT: '9999',
        LOG_LEVEL: 'silent',
        CORS_ORIGINS: 'http://localhost:3000'
      })
    }
  };
});