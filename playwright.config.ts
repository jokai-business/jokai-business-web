import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir: './tests/e2e', fullyParallel: false, workers: 1,
 timeout: 60_000, retries: 0, reporter: 'list',
 use: { actionTimeout: 10000, baseURL: process.env.BASE_URL || 'https://localhost:8443', ignoreHTTPSErrors: !process.env.BASE_URL || process.env.E2E_ALLOW_SELF_SIGNED === "true", trace: 'off', screenshot: 'off' },
});
