import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: 'test-reports/html' }],
    ['junit', { outputFile: 'test-reports/junit.xml' }],
    ['json', { outputFile: 'test-reports/test-results.json' }],
    ['line']
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.BASE_URL || 'http://localhost:5000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Collect screenshots on failure */
    screenshot: 'only-on-failure',
    
    /* Collect videos for failing tests */
    video: 'retain-on-failure',
    
    /* Ignore HTTPS errors */
    ignoreHTTPSErrors: true,
    
    /* Configure context options */
    contextOptions: {
      // Accept all cookies to test auth flows
      acceptDownloads: true,
      locale: 'en-US',
      timezoneId: 'America/New_York'
    },

    /* Configure test timeout */
    actionTimeout: 15000,
    navigationTimeout: 30000
  },

  /* Configure output directories for artifacts */
  outputDir: 'test-results/artifacts',
  
  /* Configure global setup and teardown */
  globalSetup: './tests/fixtures/global-setup.ts',
  globalTeardown: './tests/fixtures/global-teardown.ts',

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 }
      },
    },

    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 }
      },
    },

    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 }
      },
    },

    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    /* Test against branded browsers. */
    {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      NODE_ENV: 'test',
      // Test environment variables
      DATABASE_URL: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgres://localhost:5432/test',
      JWT_SECRET: process.env.JWT_SECRET || 'test-jwt-secret-very-long-for-security',
      // Mock service configurations for testing
      OPENAI_API_KEY: 'test-openai-key',
      SENDGRID_API_KEY: 'test-sendgrid-key',
      STRIPE_SECRET_KEY: 'sk_test_fake',
      STRIPE_WEBHOOK_SECRET: 'whsec_test_fake',
      PHONEPE_MERCHANT_ID: 'PGTESTPAYUAT86',
      PHONEPE_SALT_KEY: process.env.PHONEPE_SALT_KEY || 'test-phonepe-salt-key-placeholder',
    }
  },

  /* Configure test environment */
  testMatch: [
    '**/tests/e2e/**/*.test.ts',
    '**/tests/e2e/**/*.spec.ts'
  ],
  
  /* Test timeout */
  timeout: 60000,
  
  /* Expect timeout */
  expect: {
    timeout: 15000,
    toHaveScreenshot: { 
      threshold: 0.2
    }
  },

  /* Configure metadata for test reporting */
  metadata: {
    testType: 'e2e',
    environment: process.env.NODE_ENV || 'test',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  }
});