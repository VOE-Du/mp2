import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: 2,
  use: { baseURL: 'http://127.0.0.1:5173/mp2/', browserName: 'chromium', channel: 'chrome', trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:5173/mp2/', reuseExistingServer: !process.env.CI },
});
