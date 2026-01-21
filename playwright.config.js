import { defineConfig } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  timeout: isCI ? 120000 : 60000, // Longer timeout in CI for P2P discovery
  expect: {
    timeout: isCI ? 20000 : 10000,
  },
  snapshotPathTemplate: '{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}{ext}', // Platform-independent
  fullyParallel: false, // Tests share server, run sequentially
  retries: isCI ? 2 : 1, // More retries in CI for network flakiness
  reporter: isCI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'on-failure' }]],
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
