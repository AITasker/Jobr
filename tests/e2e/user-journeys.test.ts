import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';

test.describe('Complete User Journey Tests', () => {
  
  test.beforeEach(async () => {
    await TestHelpers.seedFreshTestData();
  });

  test.afterEach(async ({ page }) => {
    if (test.info().status === 'failed') {
      await TestHelpers.takeScreenshot(page, `user-journey-failure-${test.info().title}`);
    }
  });

  test('New User Onboarding Journey - Registration to First Application', async ({ page }) => {
    console.log('🧪 Testing complete new user onboarding journey...');
    
    // Step 1: User arrives and registers
    await page.goto('/');
    await expect(page.locator('[data-testid="hero-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="cta-get-started"]')).toBeVisible();
    
    await page.click('[data-testid="cta-get-started"]');
    
    // Register new user
    const newUser = {
      firstName: 'Sarah',
      lastName: 'Johnson',
      email: TestHelpers.generateTestEmail(),
      password: 'SecurePassword123!'
    };
    
    await TestHelpers.registerTestUser(page, newUser);
    
    // Step 2: Welcome and onboarding
    await expect(page.locator('[data-testid="welcome-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="onboarding-checklist"]')).toBeVisible();
    
    // Step 3: Upload CV
    await expect(page.locator('[data-testid="onboarding-step-cv"]')).toContainText('Upload your CV');
    await TestHelpers.uploadTestCV(page, 'sarah-johnson-resume.pdf');
    
    // Verify CV analysis completion
    await expect(page.locator('[data-testid="cv-analysis-complete"]')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('[data-testid="onboarding-step-cv-complete"]')).toBeVisible();
    
    // Step 4: AI job matching
    await expect(page.locator('[data-testid="job-matching-section"]')).toBeVisible();
    await page.click('[data-testid="button-find-jobs"]');
    
    await expect(page.locator('[data-testid="job-matches"]')).toBeVisible({ timeout: 15000 });
    const jobMatches = page.locator('[data-testid="job-card"]');
    await expect(jobMatches).toHaveCount.greaterThan(0);
    
    // Step 5: Apply to first job
    const bestMatch = jobMatches.first();
    await expect(bestMatch.locator('[data-testid="match-score"]')).toBeVisible();
    
    const jobTitle = await bestMatch.locator('[data-testid="job-title"]').textContent();
    await bestMatch.locator('[data-testid="button-apply-job"]').click();
    
    // Application process
    await expect(page.locator('[data-testid="application-modal"]')).toBeVisible();
    
    // Generate cover letter
    await page.click('[data-testid="button-generate-cover-letter"]');
    await expect(page.locator('[data-testid="cover-letter-content"]')).toBeVisible({ timeout: 15000 });
    
    // Submit application
    await page.click('[data-testid="button-submit-application"]');
    await expect(page.locator('[data-testid="application-success"]')).toBeVisible({ timeout: 10000 });
    
    // Step 6: Verify onboarding completion
    await expect(page.locator('[data-testid="onboarding-complete"]')).toBeVisible();
    await expect(page.locator('[data-testid="celebration-message"]')).toContainText('first application');
    
    // Step 7: Check application in tracker
    await page.click('[data-testid="button-view-applications"]');
    await expect(page.locator('[data-testid="application-item"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="application-job-title"]')).toContainText(jobTitle || '');
    
    // Verify user progress in database
    const user = await TestHelpers.getCurrentUser(newUser.email);
    expect(user).toBeTruthy();
    expect(user.plan).toBe('Free');
    expect(user.creditsRemaining).toBe(4); // 5 - 1 application
    
    const applications = await TestHelpers.getUserApplications(user.id);
    expect(applications).toHaveLength(1);
    expect(applications[0].status).toBe('applied');
    
    console.log('✅ New user onboarding journey completed successfully');
  });

  test('Active Job Seeker Journey - Multiple Applications and Tracking', async ({ page }) => {
    console.log('🧪 Testing active job seeker journey...');
    
    // Start as existing user with CV already uploaded
    await TestHelpers.loginAsTestUser(page);
    
    // Step 1: Advanced job search
    await page.click('[data-testid="tab-jobs"]');
    await page.fill('[data-testid="input-job-search"]', 'Software Engineer');
    await page.click('[data-testid="button-advanced-filters"]');
    
    // Set specific criteria
    await page.selectOption('[data-testid="select-experience-level"]', 'mid');
    await page.fill('[data-testid="input-salary-min"]', '100000');
    await page.check('[data-testid="checkbox-remote-work"]');
    await page.click('[data-testid="button-apply-filters"]');
    
    // Step 2: Apply to multiple jobs
    const jobCards = page.locator('[data-testid="job-card"]');
    const jobCount = Math.min(3, await jobCards.count());
    
    const appliedJobs = [];
    
    for (let i = 0; i < jobCount; i++) {
      const jobCard = jobCards.nth(i);
      const jobTitle = await jobCard.locator('[data-testid="job-title"]').textContent();
      appliedJobs.push(jobTitle);
      
      await jobCard.locator('[data-testid="button-apply-job"]').click();
      await expect(page.locator('[data-testid="application-modal"]')).toBeVisible();
      
      // Quick apply without cover letter generation
      await page.click('[data-testid="button-submit-application"]');
      await expect(page.locator('[data-testid="application-success"]')).toBeVisible({ timeout: 10000 });
      await page.click('[data-testid="button-close-success"]');
    }
    
    // Step 3: Check application tracker
    await page.click('[data-testid="tab-applications"]');
    await expect(page.locator('[data-testid="application-item"]')).toHaveCount.greaterThanOrEqual(jobCount);
    
    // Step 4: Update application statuses
    const applications = page.locator('[data-testid="application-item"]');
    
    // First application - employer viewed
    await applications.first().click();
    await expect(page.locator('[data-testid="application-details-modal"]')).toBeVisible();
    await page.click('[data-testid="button-update-status"]');
    await page.selectOption('[data-testid="select-new-status"]', 'viewed');
    await page.click('[data-testid="button-save-status-update"]');
    await page.click('[data-testid="button-close-modal"]');
    
    // Second application - interview scheduled
    await applications.nth(1).click();
    await page.click('[data-testid="button-update-status"]');
    await page.selectOption('[data-testid="select-new-status"]', 'interviewing');
    
    const interviewDate = new Date();
    interviewDate.setDate(interviewDate.getDate() + 3);
    await page.fill('[data-testid="input-interview-date"]', interviewDate.toISOString().split('T')[0]);
    await page.fill('[data-testid="input-interview-time"]', '15:00');
    await page.click('[data-testid="button-save-status-update"]');
    await page.click('[data-testid="button-close-modal"]');
    
    // Step 5: Check analytics and progress
    await page.click('[data-testid="tab-analytics"]');
    await expect(page.locator('[data-testid="analytics-dashboard"]')).toBeVisible();
    
    // Verify metrics reflect new applications
    const totalApps = await page.locator('[data-testid="stat-total-applications"]').textContent();
    expect(parseInt(totalApps || '0')).toBeGreaterThan(jobCount);
    
    // Step 6: Set up job alerts
    await page.click('[data-testid="tab-jobs"]');
    await page.fill('[data-testid="input-job-search"]', 'Senior Developer');
    await page.click('[data-testid="button-create-job-alert"]');
    
    await page.fill('[data-testid="input-alert-name"]', 'Senior Developer Opportunities');
    await page.selectOption('[data-testid="select-alert-frequency"]', 'weekly');
    await page.click('[data-testid="button-save-alert"]');
    
    await expect(page.locator('[data-testid="toast-message"]')).toContainText('Job alert created');
    
    console.log('✅ Active job seeker journey completed successfully');
  });

  test('Premium User Journey - Subscription and Advanced Features', async ({ page }) => {
    console.log('🧪 Testing premium user journey...');
    
    // Start as free user
    await TestHelpers.loginAsTestUser(page);
    
    // Step 1: Explore premium features
    await page.goto('/billing');
    await expect(page.locator('[data-testid="pricing-plans"]')).toBeVisible();
    
    // Check current plan
    await expect(page.locator('[data-testid="current-plan"]')).toContainText('Free');
    await expect(page.locator('[data-testid="plan-limitations"]')).toBeVisible();
    
    // Step 2: Upgrade to Premium
    await page.click('[data-testid="button-upgrade-premium"]');
    await expect(page.locator('[data-testid="checkout-modal"]')).toBeVisible();
    
    // Mock payment success
    await page.click('[data-testid="button-mock-payment-success"]');
    await expect(page.locator('[data-testid="payment-success"]')).toBeVisible({ timeout: 10000 });
    
    // Step 3: Verify premium features unlocked
    await page.goto('/dashboard');
    
    // Check updated plan status
    await page.click('[data-testid="user-menu"]');
    await expect(page.locator('[data-testid="user-plan"]')).toContainText('Premium');
    await expect(page.locator('[data-testid="user-credits"]')).toContainText('50 credits');
    
    // Step 4: Use advanced analytics
    await page.click('[data-testid="tab-analytics"]');
    await expect(page.locator('[data-testid="premium-analytics"]')).toBeVisible();
    
    // Advanced charts and insights should be available
    await expect(page.locator('[data-testid="conversion-funnel"]')).toBeVisible();
    await expect(page.locator('[data-testid="predictive-insights"]')).toBeVisible();
    await expect(page.locator('[data-testid="competitor-analysis"]')).toBeVisible();
    
    // Step 5: Use AI-powered features
    await page.click('[data-testid="tab-jobs"]');
    await page.click('[data-testid="button-ai-job-recommendations"]');
    
    await expect(page.locator('[data-testid="ai-recommendations"]')).toBeVisible();
    await expect(page.locator('[data-testid="personalized-insights"]')).toBeVisible();
    
    // Step 6: Bulk operations
    await page.click('[data-testid="tab-applications"]');
    await page.click('[data-testid="button-bulk-operations"]');
    
    await expect(page.locator('[data-testid="bulk-selection-mode"]')).toBeVisible();
    
    console.log('✅ Premium user journey completed successfully');
  });

  test('Power User Journey - Advanced Search and Bulk Operations', async ({ page }) => {
    console.log('🧪 Testing power user journey with advanced features...');
    
    // Login as premium user with existing data
    await TestHelpers.loginAsTestUser(page, 'premium.user@test.com');
    
    // Step 1: Advanced job search with complex criteria
    await page.click('[data-testid="tab-jobs"]');
    await page.click('[data-testid="button-advanced-search"]');
    
    // Set complex search criteria
    await page.fill('[data-testid="input-job-search"]', 'Senior Full Stack Developer');
    await page.fill('[data-testid="input-location-search"]', 'San Francisco OR New York OR Remote');
    await page.selectOption('[data-testid="select-experience-level"]', 'senior');
    await page.fill('[data-testid="input-salary-min"]', '150000');
    await page.fill('[data-testid="input-salary-max"]', '250000');
    
    // Technology stack filters
    await page.check('[data-testid="checkbox-tech-react"]');
    await page.check('[data-testid="checkbox-tech-nodejs"]');
    await page.check('[data-testid="checkbox-tech-aws"]');
    
    // Company filters
    await page.selectOption('[data-testid="select-company-size"]', 'large');
    await page.check('[data-testid="checkbox-public-company"]');
    
    await page.click('[data-testid="button-execute-advanced-search"]');
    
    // Step 2: Save and manage searches
    await page.click('[data-testid="button-save-search"]');
    await page.fill('[data-testid="input-search-name"]', 'Senior Full Stack - Top Companies');
    await page.check('[data-testid="checkbox-enable-alerts"]');
    await page.selectOption('[data-testid="select-alert-frequency"]', 'daily');
    await page.click('[data-testid="button-confirm-save-search"]');
    
    // Step 3: Bulk job analysis
    const jobCards = page.locator('[data-testid="job-card"]');
    const jobCount = Math.min(5, await jobCards.count());
    
    // Select jobs for bulk analysis
    for (let i = 0; i < jobCount; i++) {
      await jobCards.nth(i).locator('[data-testid="checkbox-select-job"]').check();
    }
    
    await page.click('[data-testid="button-bulk-analyze"]');
    await expect(page.locator('[data-testid="bulk-analysis-modal"]')).toBeVisible();
    
    // Review bulk analysis results
    await expect(page.locator('[data-testid="analysis-summary"]')).toBeVisible();
    await expect(page.locator('[data-testid="job-comparison-matrix"]')).toBeVisible();
    await expect(page.locator('[data-testid="recommendation-scores"]')).toBeVisible();
    
    // Step 4: Bulk application submission
    await page.click('[data-testid="button-select-top-matches"]');
    await page.click('[data-testid="button-bulk-apply"]');
    
    await expect(page.locator('[data-testid="bulk-application-modal"]')).toBeVisible();
    
    // Configure bulk application settings
    await page.check('[data-testid="checkbox-generate-cover-letters"]');
    await page.check('[data-testid="checkbox-tailor-cv"]');
    await page.selectOption('[data-testid="select-application-template"]', 'professional');
    
    await page.click('[data-testid="button-start-bulk-apply"]');
    
    // Monitor bulk application progress
    await expect(page.locator('[data-testid="bulk-progress-bar"]')).toBeVisible();
    await expect(page.locator('[data-testid="applications-submitted-count"]')).toBeVisible();
    
    // Wait for completion
    await expect(page.locator('[data-testid="bulk-application-complete"]')).toBeVisible({ timeout: 60000 });
    
    // Step 5: Advanced tracking and analytics
    await page.click('[data-testid="tab-applications"]');
    
    // Set up advanced tracking
    await page.click('[data-testid="button-configure-tracking"]');
    await page.check('[data-testid="checkbox-email-tracking"]');
    await page.check('[data-testid="checkbox-linkedin-tracking"]');
    await page.check('[data-testid="checkbox-company-updates"]');
    await page.click('[data-testid="button-save-tracking-config"]');
    
    // Step 6: Performance optimization insights
    await page.click('[data-testid="tab-optimization"]');
    await expect(page.locator('[data-testid="optimization-dashboard"]')).toBeVisible();
    
    // Review AI recommendations for improving application success
    await expect(page.locator('[data-testid="optimization-recommendations"]')).toBeVisible();
    const recommendations = page.locator('[data-testid="recommendation-item"]');
    await expect(recommendations).toHaveCount.greaterThan(0);
    
    // Implement a recommendation
    await recommendations.first().locator('[data-testid="button-apply-recommendation"]').click();
    await expect(page.locator('[data-testid="toast-message"]')).toContainText('Recommendation applied');
    
    console.log('✅ Power user journey completed successfully');
  });

  test('End-to-End User Lifecycle - From Registration to Job Offer', async ({ page }) => {
    console.log('🧪 Testing complete end-to-end user lifecycle...');
    
    // This test simulates a complete successful job search journey
    const testUser = {
      firstName: 'Michael',
      lastName: 'Rodriguez',
      email: TestHelpers.generateTestEmail(),
      password: 'SecurePassword123!'
    };
    
    // Phase 1: Initial Registration and Setup
    await page.goto('/');
    await page.click('[data-testid="cta-get-started"]');
    await TestHelpers.registerTestUser(page, testUser);
    
    await expect(page.locator('[data-testid="welcome-dashboard"]')).toBeVisible();
    
    // Phase 2: Profile Completion
    await TestHelpers.uploadTestCV(page, 'michael-rodriguez-cv.pdf');
    await expect(page.locator('[data-testid="cv-analysis-complete"]')).toBeVisible({ timeout: 30000 });
    
    // Set preferences
    await page.click('[data-testid="button-set-preferences"]');
    await page.selectOption('[data-testid="select-job-level"]', 'senior');
    await page.fill('[data-testid="input-desired-salary"]', '140000');
    await page.check('[data-testid="checkbox-remote-preferred"]');
    await page.click('[data-testid="button-save-preferences"]');
    
    // Phase 3: Job Discovery and Applications
    await page.click('[data-testid="button-find-jobs"]');
    await expect(page.locator('[data-testid="job-matches"]')).toBeVisible({ timeout: 15000 });
    
    // Apply to top 3 matches
    const topJobs = page.locator('[data-testid="job-card"]').first();
    for (let i = 0; i < 3; i++) {
      const jobCard = page.locator('[data-testid="job-card"]').nth(i);
      await jobCard.locator('[data-testid="button-apply-job"]').click();
      
      await expect(page.locator('[data-testid="application-modal"]')).toBeVisible();
      await page.click('[data-testid="button-generate-cover-letter"]');
      await expect(page.locator('[data-testid="cover-letter-content"]')).toBeVisible({ timeout: 15000 });
      await page.click('[data-testid="button-submit-application"]');
      await expect(page.locator('[data-testid="application-success"]')).toBeVisible();
      await page.click('[data-testid="button-close-success"]');
    }
    
    // Phase 4: Application Management and Follow-up
    await page.click('[data-testid="tab-applications"]');
    const applications = page.locator('[data-testid="application-item"]');
    await expect(applications).toHaveCount(3);
    
    // Simulate application progression
    // First application: No response (will remain in applied status)
    
    // Second application: Employer viewed
    await applications.nth(1).click();
    await page.click('[data-testid="button-update-status"]');
    await page.selectOption('[data-testid="select-new-status"]', 'viewed');
    await page.fill('[data-testid="textarea-status-notes"]', 'HR team reviewed application');
    await page.click('[data-testid="button-save-status-update"]');
    await page.click('[data-testid="button-close-modal"]');
    
    // Third application: Interview scheduled  
    await applications.nth(2).click();
    await page.click('[data-testid="button-update-status"]');
    await page.selectOption('[data-testid="select-new-status"]', 'interviewing');
    
    const interviewDate = new Date();
    interviewDate.setDate(interviewDate.getDate() + 5);
    await page.fill('[data-testid="input-interview-date"]', interviewDate.toISOString().split('T')[0]);
    await page.fill('[data-testid="input-interview-time"]', '14:00');
    await page.fill('[data-testid="textarea-interview-notes"]', 'Technical interview with senior engineer');
    await page.click('[data-testid="button-save-status-update"]');
    
    // Phase 5: Interview Preparation
    await page.click('[data-testid="tab-interview-prep"]');
    await page.click('[data-testid="button-start-interview-prep"]');
    
    // Complete preparation checklist
    const prepItems = page.locator('[data-testid="prep-checklist-item"]');
    const itemCount = await prepItems.count();
    for (let i = 0; i < itemCount; i++) {
      await prepItems.nth(i).locator('[data-testid="checkbox-prep-item"]').check();
    }
    
    await expect(page.locator('[data-testid="prep-complete"]')).toBeVisible();
    await page.click('[data-testid="button-close-modal"]');
    
    // Phase 6: Post-Interview Follow-up
    // Simulate interview completion
    await applications.nth(2).click();
    await page.click('[data-testid="button-update-status"]');
    await page.selectOption('[data-testid="select-new-status"]', 'offered');
    await page.fill('[data-testid="textarea-status-notes"]', 'Received job offer! Salary: $145,000');
    await page.click('[data-testid="button-save-status-update"]');
    
    // Phase 7: Success Analytics and Insights
    await page.click('[data-testid="tab-analytics"]');
    await expect(page.locator('[data-testid="success-metrics"]')).toBeVisible();
    
    // Verify success rate
    const successRate = await page.locator('[data-testid="stat-success-rate"]').textContent();
    expect(parseFloat(successRate || '0')).toBeGreaterThan(0);
    
    // Check job search timeline
    await expect(page.locator('[data-testid="timeline-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="offer-received-milestone"]')).toBeVisible();
    
    // Verify database state reflects complete journey
    const user = await TestHelpers.getCurrentUser(testUser.email);
    expect(user).toBeTruthy();
    
    const userApplications = await TestHelpers.getUserApplications(user.id);
    expect(userApplications).toHaveLength(3);
    expect(userApplications.some(app => app.status === 'offered')).toBe(true);
    
    console.log('✅ Complete end-to-end user lifecycle completed successfully');
  });
});