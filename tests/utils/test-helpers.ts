import { Page, Locator, expect } from '@playwright/test';
import { TestDatabase } from '../fixtures/test-database';
import { TestDataSeeder } from '../fixtures/test-data-seeder';

/**
 * Test Helper Utilities
 * Common functions used across E2E tests
 */
export class TestHelpers {
  
  /**
   * Login with test credentials
   */
  static async loginAsTestUser(page: Page, userEmail: string = 'john.doe@test.com', password: string = 'testpassword123') {
    await page.goto('/login');
    
    // Wait for login form to load
    await page.waitForSelector('[data-testid="input-email"]');
    
    // Fill in credentials
    await page.fill('[data-testid="input-email"]', userEmail);
    await page.fill('[data-testid="input-password"]', password);
    
    // Submit login form
    await page.click('[data-testid="button-login"]');
    
    // Wait for successful login redirect
    await page.waitForURL('/dashboard');
    
    // Verify user is logged in
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  }

  /**
   * Register a new test user
   */
  static async registerTestUser(page: Page, userData: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }) {
    await page.goto('/signup');
    
    // Wait for signup form
    await page.waitForSelector('[data-testid="input-email"]');
    
    // Fill registration form
    await page.fill('[data-testid="input-first-name"]', userData.firstName);
    await page.fill('[data-testid="input-last-name"]', userData.lastName);
    await page.fill('[data-testid="input-email"]', userData.email);
    await page.fill('[data-testid="input-password"]', userData.password);
    await page.fill('[data-testid="input-confirm-password"]', userData.password);
    
    // Submit registration
    await page.click('[data-testid="button-register"]');
    
    // Wait for successful registration
    await page.waitForURL('/dashboard');
  }

  /**
   * Logout current user
   */
  static async logout(page: Page) {
    // Open user menu
    await page.click('[data-testid="user-menu"]');
    
    // Click logout
    await page.click('[data-testid="button-logout"]');
    
    // Wait for redirect to home
    await page.waitForURL('/');
  }

  /**
   * Upload a test CV file
   */
  static async uploadTestCV(page: Page, fileName: string = 'test-resume.pdf') {
    // Navigate to dashboard if not already there
    if (!page.url().includes('/dashboard')) {
      await page.goto('/dashboard');
    }
    
    // Wait for CV upload section
    await page.waitForSelector('[data-testid="cv-upload-area"]');
    
    // Create test file buffer (simulated PDF content)
    const testPDFContent = Buffer.from(`%PDF-1.4
Test Resume
John Doe
Software Engineer

Experience:
- 5 years of frontend development
- Expert in React, JavaScript, TypeScript

Education:
- BS Computer Science, MIT 2018

Skills:
- JavaScript
- React
- TypeScript
- CSS
- HTML
- Git`);

    // Upload file
    const fileInput = page.locator('[data-testid="file-input-cv"]');
    await fileInput.setInputFiles({
      name: fileName,
      mimeType: 'application/pdf',
      buffer: testPDFContent
    });
    
    // Wait for upload completion
    await page.waitForSelector('[data-testid="cv-upload-success"]', { timeout: 30000 });
    
    // Wait for AI analysis to complete
    await expect(page.locator('[data-testid="cv-analysis-complete"]')).toBeVisible({ timeout: 30000 });
  }

  /**
   * Search for jobs with filters
   */
  static async searchJobs(page: Page, searchQuery: string, filters?: {
    location?: string;
    jobType?: string;
    salaryRange?: [number, number];
    remote?: boolean;
  }) {
    // Navigate to dashboard if not already there
    if (!page.url().includes('/dashboard')) {
      await page.goto('/dashboard');
    }
    
    // Switch to jobs tab
    await page.click('[data-testid="tab-jobs"]');
    
    // Enter search query
    if (searchQuery) {
      await page.fill('[data-testid="input-job-search"]', searchQuery);
    }
    
    // Apply filters if provided
    if (filters) {
      if (filters.location) {
        await page.fill('[data-testid="input-location-filter"]', filters.location);
      }
      
      if (filters.jobType) {
        await page.selectOption('[data-testid="select-job-type"]', filters.jobType);
      }
      
      if (filters.remote) {
        await page.check('[data-testid="checkbox-remote-only"]');
      }
    }
    
    // Trigger search
    await page.click('[data-testid="button-search-jobs"]');
    
    // Wait for search results
    await page.waitForSelector('[data-testid="job-search-results"]');
  }

  /**
   * Apply to a job
   */
  static async applyToJob(page: Page, jobTitle: string) {
    // Find job card by title
    const jobCard = page.locator(`[data-testid="job-card"][data-job-title="${jobTitle}"]`);
    await expect(jobCard).toBeVisible();
    
    // Click apply button
    await jobCard.locator('[data-testid="button-apply-job"]').click();
    
    // Wait for application confirmation
    await expect(page.locator('[data-testid="application-success-message"]')).toBeVisible();
  }

  /**
   * Navigate to applications tracker
   */
  static async goToApplications(page: Page) {
    await page.goto('/dashboard');
    await page.click('[data-testid="tab-applications"]');
    await page.waitForSelector('[data-testid="applications-list"]');
  }

  /**
   * Wait for element with retry logic
   */
  static async waitForElementWithRetry(page: Page, selector: string, maxRetries: number = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await page.waitForSelector(selector, { timeout: 10000 });
        return;
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await page.reload();
        await page.waitForTimeout(2000);
      }
    }
  }

  /**
   * Take screenshot with timestamp
   */
  static async takeScreenshot(page: Page, name: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = `test-results/screenshots/${name}-${timestamp}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Screenshot saved: ${screenshotPath}`);
    return screenshotPath;
  }

  /**
   * Verify database state
   */
  static async verifyDatabaseState(expectedCounts: Record<string, number>) {
    const stats = await TestDatabase.getStats();
    
    for (const [table, expectedCount] of Object.entries(expectedCounts)) {
      expect(stats[table]).toBe(expectedCount);
    }
  }

  /**
   * Wait for API call completion
   */
  static async waitForAPICall(page: Page, endpoint: string, method: string = 'GET') {
    return page.waitForResponse(response => 
      response.url().includes(endpoint) && response.request().method() === method
    );
  }

  /**
   * Fill form fields
   */
  static async fillForm(page: Page, formData: Record<string, string>) {
    for (const [field, value] of Object.entries(formData)) {
      await page.fill(`[data-testid="input-${field}"]`, value);
    }
  }

  /**
   * Assert toast message appears
   */
  static async assertToastMessage(page: Page, message: string) {
    await expect(page.locator('[data-testid="toast-message"]')).toContainText(message);
  }

  /**
   * Clear all test data
   */
  static async clearTestData() {
    await TestDatabase.reset();
  }

  /**
   * Seed fresh test data
   */
  static async seedFreshTestData() {
    await TestDatabase.reset();
    await TestDataSeeder.seedAll();
  }

  /**
   * Get current user from database
   */
  static async getCurrentUser(email: string) {
    const db = TestDatabase.getDb();
    const users = await db.query.users.findMany({
      where: (users, { eq }) => eq(users.email, email)
    });
    return users[0] || null;
  }

  /**
   * Get applications for user
   */
  static async getUserApplications(userId: string) {
    const db = TestDatabase.getDb();
    const applications = await db.query.applications.findMany({
      where: (applications, { eq }) => eq(applications.userId, userId),
      with: {
        job: true
      }
    });
    return applications;
  }

  /**
   * Generate random email for test user
   */
  static generateTestEmail(): string {
    return `test-${Math.random().toString(36).substr(2, 9)}@example.com`;
  }

  /**
   * Wait for loading to complete
   */
  static async waitForLoadingToComplete(page: Page) {
    // Wait for any loading indicators to disappear
    await page.waitForFunction(() => {
      const loadingElements = document.querySelectorAll('[data-testid*="loading"], .animate-spin');
      return loadingElements.length === 0;
    }, { timeout: 30000 });
  }

  /**
   * Intercept and mock API response
   */
  static async mockAPIResponse(page: Page, endpoint: string, responseData: any) {
    await page.route(`**/${endpoint}`, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(responseData)
      });
    });
  }

  /**
   * Assert element visibility with retry
   */
  static async assertVisibleWithRetry(page: Page, selector: string, maxRetries: number = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await expect(page.locator(selector)).toBeVisible({ timeout: 5000 });
        return;
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await page.waitForTimeout(1000);
      }
    }
  }
}