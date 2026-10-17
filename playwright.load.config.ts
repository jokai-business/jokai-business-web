import { defineConfig } from '@playwright/test';

// This small baseline is intentionally confined to the local deployment.
const baseURL = 'https://localhost:8443';
if (process.env.BASE_URL && process.env.BASE_URL !== baseURL) {
  throw new Error('The load smoke test only supports https://localhost:8443.');
}

export default defineConfig({
  testDir: './tests/load',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  reporter: 'list',
  use: {
    baseURL,
    ignoreHTTPSErrors: true,
    actionTimeout: 20_000,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
});
