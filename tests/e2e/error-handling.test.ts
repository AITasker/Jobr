import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';
import { MockOpenAIService } from '../mocks/mock-openai-service';
import { MockSendGridService } from '../mocks/mock-sendgrid-service';
import { MockStripeService } from '../mocks/mock-stripe-service';

test.describe('Error Handling and Edge Case Tests', () => {
  
  test.beforeEach(async () => {
    await TestHelpers.seedFreshTestData();
  });

  test.afterEach(async ({ page }) => {
    if (test.info().status === 'failed') {
      await TestHelpers.takeScreenshot(page, `error-handling-failure-${test.info().title}`);
    }
  });

  test('Network Failure Handling - API Service Unavailable', async ({ page }) => {
    console.log('🧪 Testing network failure handling...');
    
    await TestHelpers.loginAsTestUser(page);
    
    // Simulate network failure for API calls
    await page.route('**/api/**', async route => {
      await route.abort('failed');
    });
    
    // Attempt to navigate to jobs section
    await page.click('[data-testid="tab-jobs"]');
    
    // Should show error message
    await expect(page.locator('[data-testid="network-error-message"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
    
    // Test retry mechanism
    let retryCount = 0;
    await page.route('**/api/jobs**', async route => {
      retryCount++;
      if (retryCount <= 2) {
        await route.abort('failed');
      } else {
        await route.continue();
      }
    });
    
    await page.click('[data-testid="retry-button"]');
    
    // Should eventually succeed after retries
    await expect(page.locator('[data-testid="jobs-section"]')).toBeVisible({ timeout: 15000 });
    
    console.log('✅ Network failure handling completed successfully');
  });

  test('API Rate Limiting - Graceful Degradation', async ({ page }) => {
    console.log('🧪 Testing API rate limiting handling...');
    
    await TestHelpers.loginAsTestUser(page);
    
    // Simulate rate limiting response
    let requestCount = 0;
    await page.route('**/api/jobs/matched**', async route => {
      requestCount++;
      if (requestCount <= 3) {
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Rate limit exceeded',
            retryAfter: 2
          })
        });
      } else {
        await route.continue();
      }
    });
    
    // Trigger job matching
    await TestHelpers.uploadTestCV(page);
    await page.click('[data-testid="button-find-jobs"]');
    
    // Should show rate limit message
    await expect(page.locator('[data-testid="rate-limit-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="retry-countdown"]')).toBeVisible();
    
    // Wait for retry countdown and automatic retry
    await expect(page.locator('[data-testid="job-matches"]')).toBeVisible({ timeout: 30000 });
    
    console.log('✅ API rate limiting handling completed successfully');
  });

  test('File Upload Validation and Error Handling', async ({ page }) => {
    console.log('🧪 Testing file upload validation...');
    
    await TestHelpers.loginAsTestUser(page);
    
    // Test 1: Invalid file type
    const invalidFile = Buffer.from('This is not a valid CV file content');
    let fileInput = page.locator('[data-testid="file-input-cv"]');
    
    await fileInput.setInputFiles({
      name: 'invalid-cv.txt',
      mimeType: 'text/plain',
      buffer: invalidFile
    });
    
    await expect(page.locator('[data-testid="upload-error"]')).toContainText('Invalid file type');
    await expect(page.locator('[data-testid="error-details"]')).toContainText('PDF, DOC, or DOCX');
    
    // Test 2: File too large
    const largeFile = Buffer.alloc(10 * 1024 * 1024, 'x'); // 10MB file
    fileInput = page.locator('[data-testid="file-input-cv"]');
    
    await fileInput.setInputFiles({
      name: 'large-cv.pdf',
      mimeType: 'application/pdf',
      buffer: largeFile
    });
    
    await expect(page.locator('[data-testid="upload-error"]')).toContainText('File too large');
    await expect(page.locator('[data-testid="error-details"]')).toContainText('5MB limit');
    
    // Test 3: Corrupted file
    const corruptedFile = Buffer.from('%PDF-1.4\nCorrupted content...');
    fileInput = page.locator('[data-testid="file-input-cv"]');
    
    await fileInput.setInputFiles({
      name: 'corrupted-cv.pdf',
      mimeType: 'application/pdf',
      buffer: corruptedFile
    });
    
    // Should show processing error after upload attempt
    await expect(page.locator('[data-testid="processing-error"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="error-details"]')).toContainText('Unable to process');
    
    // Test retry with valid file
    await page.click('[data-testid="button-try-again"]');
    await TestHelpers.uploadTestCV(page, 'valid-cv.pdf');
    await expect(page.locator('[data-testid="cv-analysis-complete"]')).toBeVisible({ timeout: 30000 });
    
    console.log('✅ File upload validation completed successfully');
  });

  test('Authentication Session Timeout Handling', async ({ page }) => {
    console.log('🧪 Testing session timeout handling...');
    
    await TestHelpers.loginAsTestUser(page);
    
    // Simulate session expiry
    await page.route('**/api/auth/me', async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Session expired' })
      });
    });
    
    // Navigate to protected area
    await page.click('[data-testid="tab-applications"]');
    
    // Should detect expired session and show login modal
    await expect(page.locator('[data-testid="session-expired-modal"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="relogin-prompt"]')).toContainText('Please log in again');
    
    // Test re-authentication
    await page.fill('[data-testid="input-reauth-password"]', 'testpassword123');
    await page.click('[data-testid="button-reauth"]');
    
    // Remove the mock to allow normal authentication
    await page.unroute('**/api/auth/me');
    
    // Should restore access
    await expect(page.locator('[data-testid="applications-list"]')).toBeVisible({ timeout: 10000 });
    
    console.log('✅ Session timeout handling completed successfully');
  });

  test('AI Service Failure - Fallback to Basic Processing', async ({ page }) => {
    console.log('🧪 Testing AI service failure fallback...');
    
    // Simulate OpenAI service failure
    MockOpenAIService.simulateFailure(true);
    
    await TestHelpers.loginAsTestUser(page);
    
    // Upload CV - should fall back to basic processing
    await TestHelpers.uploadTestCV(page, 'fallback-test-cv.pdf');
    
    // Should show fallback processing message
    await expect(page.locator('[data-testid="processing-fallback"]')).toBeVisible();
    await expect(page.locator('[data-testid="fallback-message"]')).toContainText('basic parsing');
    
    // CV should still be processed (without AI analysis)
    await expect(page.locator('[data-testid="cv-uploaded"]')).toBeVisible({ timeout: 30000 });
    
    // Basic job matching should still work
    await page.click('[data-testid="button-find-jobs"]');
    await expect(page.locator('[data-testid="job-matches"]')).toBeVisible({ timeout: 15000 });
    
    // But with lower match scores (basic matching)
    const firstJob = page.locator('[data-testid="job-card"]').first();
    await expect(firstJob.locator('[data-testid="match-method"]')).toContainText('basic');
    
    // Reset AI service for other tests
    MockOpenAIService.simulateFailure(false);
    
    console.log('✅ AI service failure fallback completed successfully');
  });

  test('Email Service Failure - Graceful Handling', async ({ page }) => {
    console.log('🧪 Testing email service failure...');
    
    // Simulate SendGrid failure
    MockSendGridService.simulateDeliveryFailure(true);
    
    await TestHelpers.loginAsTestUser(page);
    await TestHelpers.uploadTestCV(page);
    
    // Apply to a job (should attempt to send application email)
    await page.click('[data-testid="tab-jobs"]');
    const firstJob = page.locator('[data-testid="job-card"]').first();
    await firstJob.locator('[data-testid="button-apply-job"]').click();
    
    await expect(page.locator('[data-testid="application-modal"]')).toBeVisible();
    await page.click('[data-testid="button-submit-application"]');
    
    // Should show email failure warning but still record application
    await expect(page.locator('[data-testid="email-warning"]')).toBeVisible();
    await expect(page.locator('[data-testid="application-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Application submitted');
    
    // Verify application was recorded despite email failure
    await page.click('[data-testid="tab-applications"]');
    await expect(page.locator('[data-testid="application-item"]')).toHaveCount.greaterThan(0);
    
    // Reset email service
    MockSendGridService.simulateDeliveryFailure(false);
    
    console.log('✅ Email service failure handling completed successfully');
  });

  test('Payment Processing Failures', async ({ page }) => {
    console.log('🧪 Testing payment processing failures...');
    
    await TestHelpers.loginAsTestUser(page);
    await page.goto('/billing');
    
    // Simulate payment failure
    MockStripeService.simulatePaymentFailure(true);
    
    // Attempt to upgrade to premium
    await page.click('[data-testid="button-upgrade-premium"]');
    await expect(page.locator('[data-testid="checkout-modal"]')).toBeVisible();
    
    // Fill payment form
    await page.fill('[data-testid="input-card-number"]', '4000000000000002'); // Declined test card
    await page.fill('[data-testid="input-card-expiry"]', '12/25');
    await page.fill('[data-testid="input-card-cvc"]', '123');
    
    await page.click('[data-testid="button-submit-payment"]');
    
    // Should show payment failure message
    await expect(page.locator('[data-testid="payment-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('declined');
    
    // Should offer retry options
    await expect(page.locator('[data-testid="button-try-different-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="button-contact-support"]')).toBeVisible();
    
    // Test retry with valid card
    MockStripeService.simulatePaymentFailure(false);
    await page.click('[data-testid="button-try-different-card"]');
    
    await page.fill('[data-testid="input-card-number"]', '4000000000000069'); // Success test card
    await page.click('[data-testid="button-submit-payment"]');
    
    await expect(page.locator('[data-testid="payment-success"]')).toBeVisible({ timeout: 10000 });
    
    console.log('✅ Payment processing failure handling completed successfully');
  });

  test('Concurrent User Actions - Race Condition Handling', async ({ page, context }) => {
    console.log('🧪 Testing concurrent user actions...');
    
    await TestHelpers.loginAsTestUser(page);
    
    // Open second tab for same user
    const secondTab = await context.newPage();
    await TestHelpers.loginAsTestUser(secondTab);
    
    // Simulate concurrent application submissions
    await Promise.all([
      // Tab 1: Apply to first job
      (async () => {
        await page.click('[data-testid="tab-jobs"]');
        const job1 = page.locator('[data-testid="job-card"]').first();
        await job1.locator('[data-testid="button-apply-job"]').click();
        await page.click('[data-testid="button-submit-application"]');
      })(),
      
      // Tab 2: Apply to second job simultaneously
      (async () => {
        await secondTab.click('[data-testid="tab-jobs"]');
        const job2 = secondTab.locator('[data-testid="job-card"]').nth(1);
        await job2.locator('[data-testid="button-apply-job"]').click();
        await secondTab.click('[data-testid="button-submit-application"]');
      })()
    ]);
    
    // Both applications should succeed without conflicts
    await expect(page.locator('[data-testid="application-success"]')).toBeVisible();
    await expect(secondTab.locator('[data-testid="application-success"]')).toBeVisible();
    
    // Verify both applications are recorded
    await page.click('[data-testid="tab-applications"]');
    await expect(page.locator('[data-testid="application-item"]')).toHaveCount.greaterThanOrEqual(2);
    
    console.log('✅ Concurrent user actions handling completed successfully');
  });

  test('Browser Compatibility and Feature Detection', async ({ page }) => {
    console.log('🧪 Testing browser compatibility...');
    
    // Test modern feature detection
    const hasFileAPI = await page.evaluate(() => {
      return typeof File !== 'undefined' && typeof FileReader !== 'undefined';
    });
    
    if (!hasFileAPI) {
      // Should show fallback UI for older browsers
      await page.goto('/dashboard');
      await expect(page.locator('[data-testid="upload-fallback"]')).toBeVisible();
      await expect(page.locator('[data-testid="browser-compatibility-warning"]')).toBeVisible();
    }
    
    // Test localStorage availability
    const hasLocalStorage = await page.evaluate(() => {
      try {
        localStorage.setItem('test', 'test');
        localStorage.removeItem('test');
        return true;
      } catch {
        return false;
      }
    });
    
    if (!hasLocalStorage) {
      // Should handle gracefully without localStorage
      await TestHelpers.loginAsTestUser(page);
      await expect(page.locator('[data-testid="storage-warning"]')).toBeVisible();
    }
    
    console.log('✅ Browser compatibility testing completed successfully');
  });

  test('Data Consistency - Optimistic Updates and Rollback', async ({ page }) => {
    console.log('🧪 Testing data consistency with optimistic updates...');
    
    await TestHelpers.loginAsTestUser(page);
    await TestHelpers.goToApplications(page);
    
    // Get initial application count
    const initialCount = await page.locator('[data-testid="application-item"]').count();
    
    // Simulate network failure for status update
    await page.route('**/api/applications/*/status', async route => {
      // Delay and then fail
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Server error' })
      });
    });
    
    // Attempt status update
    const firstApp = page.locator('[data-testid="application-item"]').first();
    await firstApp.click();
    await page.click('[data-testid="button-update-status"]');
    await page.selectOption('[data-testid="select-new-status"]', 'viewed');
    await page.click('[data-testid="button-save-status-update"]');
    
    // Should show optimistic update initially
    await expect(page.locator('[data-testid="status-updating"]')).toBeVisible();
    
    // Then show error and rollback
    await expect(page.locator('[data-testid="update-failed"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="status-rollback"]')).toBeVisible();
    
    // Status should be back to original
    await page.click('[data-testid="button-close-modal"]');
    await expect(firstApp.locator('[data-testid="application-status"]')).toContainText('Applied');
    
    console.log('✅ Data consistency testing completed successfully');
  });
});