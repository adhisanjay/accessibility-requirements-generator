import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: { baseURL: 'http://localhost:5173', ...devices['Desktop Chrome'] },
  webServer: [
    { command: 'npm run dev --workspace api', url: 'http://localhost:3000/api/health', reuseExistingServer: true },
    { command: 'npm run dev --workspace web', url: 'http://localhost:5173', reuseExistingServer: true },
  ],
});
