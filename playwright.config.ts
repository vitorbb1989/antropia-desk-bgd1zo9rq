import { defineConfig, devices } from '@playwright/test'

/**
 * Smoke E2E config.
 *
 * Padrao: rodar contra STAGING (`https://staging-desk.antrop-ia.com`).
 * Para testar local: `E2E_BASE_URL=http://localhost:8080 npx playwright test`.
 *
 * Credenciais via E2E_USER / E2E_PASS (no CI: GitHub Secrets).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // smoke = sequencial, ordem importa
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'https://staging-desk.antrop-ia.com',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
