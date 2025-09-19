import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';
import { TestDatabase } from '../fixtures/test-database';

test.describe('Application Tracking and Lifecycle Tests', () => {
  
  test.beforeEach(async () => {
    await TestHelpers.seedFreshTestData();
  });

  test.afterEach(async ({ page }) => {
    if (test.info().status === 'failed') {
      await TestHelpers.takeScreenshot(page, `application-tracking-failure-${test.info().title}`);
    }
  });

  test('Application Lifecycle Management - Status Updates', async ({ page }) => {
    console.log('🧪 Testing application lifecycle management...');
    
    await TestHelpers.loginAsTestUser(page);
    await TestHelpers.goToApplications(page);

    // Verify existing applications are displayed
    const applicationsList = page.locator('[data-testid="applications-list"]');
    await expect(applicationsList).toBeVisible();
    
    const applicationItems = page.locator('[data-testid="application-item"]');
    await expect(applicationItems).toHaveCount.greaterThan(0);

    // Select first application for status update
    const firstApplication = applicationItems.first();
    await firstApplication.click();
    
    // Open application details modal
    await expect(page.locator('[data-testid="application-details-modal"]')).toBeVisible();
    
    // Verify current status
    await expect(page.locator('[data-testid="application-current-status"]')).toContainText('Applied');
    
    // Update status to "Viewed"
    await page.click('[data-testid="button-update-status"]');
    await page.selectOption('[data-testid="select-new-status"]', 'viewed');
    await page.fill('[data-testid="textarea-status-notes"]', 'Employer viewed application on company portal');
    await page.click('[data-testid="button-save-status-update"]');
    
    // Verify status update
    await expect(page.locator('[data-testid="toast-message"]')).toContainText('Status updated');
    await expect(page.locator('[data-testid="application-current-status"]')).toContainText('Viewed');
    
    // Verify status history
    const statusHistory = page.locator('[data-testid="status-history"]');
    await expect(statusHistory).toBeVisible();
    await expect(statusHistory.locator('[data-testid="status-entry"]')).toHaveCount(2); // Applied + Viewed
    
    // Update to interview scheduled
    await page.click('[data-testid="button-update-status"]');
    await page.selectOption('[data-testid="select-new-status"]', 'interviewing');
    
    // Set interview date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    await page.fill('[data-testid="input-interview-date"]', tomorrowStr);
    await page.fill('[data-testid="input-interview-time"]', '14:30');
    await page.fill('[data-testid="textarea-interview-notes"]', 'Technical interview with engineering team');
    await page.click('[data-testid="button-save-status-update"]');
    
    // Verify interview scheduled
    await expect(page.locator('[data-testid="application-current-status"]')).toContainText('Interview');
    await expect(page.locator('[data-testid="interview-details"]')).toBeVisible();
    await expect(page.locator('[data-testid="interview-date"]')).toContainText(tomorrowStr);
    
    console.log('✅ Application lifecycle management completed successfully');
  });

  test('Email Tracking and Interactions', async ({ page }) => {
    console.log('🧪 Testing email tracking functionality...');
    
    await TestHelpers.loginAsTestUser(page, 'premium.user@test.com');
    await TestHelpers.goToApplications(page);

    // Find application with email tracking
    const applicationItems = page.locator('[data-testid="application-item"]');
    const emailTrackedApp = applicationItems.first();
    await emailTrackedApp.click();

    await expect(page.locator('[data-testid="application-details-modal"]')).toBeVisible();
    
    // Verify email tracking section
    await expect(page.locator('[data-testid="email-tracking-section"]')).toBeVisible();
    
    // Check email status indicators
    const emailStatus = page.locator('[data-testid="email-status"]');
    await expect(emailStatus).toBeVisible();
    
    // Should show email sent status
    await expect(page.locator('[data-testid="email-sent-indicator"]')).toBeVisible();
    
    // Check if email was opened (from seeded data)
    const emailOpened = page.locator('[data-testid="email-opened-indicator"]');
    if (await emailOpened.isVisible()) {
      await expect(page.locator('[data-testid="email-open-timestamp"]')).toBeVisible();
      await expect(page.locator('[data-testid="email-open-timestamp"]')).toContainText('ago');
    }
    
    // Verify email timeline
    await expect(page.locator('[data-testid="email-timeline"]')).toBeVisible();
    const timelineEvents = page.locator('[data-testid="timeline-event"]');
    await expect(timelineEvents).toHaveCount.greaterThan(0);
    
    // Check email analytics
    await page.click('[data-testid="tab-email-analytics"]');
    await expect(page.locator('[data-testid="email-analytics"]')).toBeVisible();
    
    // Verify analytics metrics
    await expect(page.locator('[data-testid="open-rate-metric"]')).toBeVisible();
    await expect(page.locator('[data-testid="response-rate-metric"]')).toBeVisible();

    console.log('✅ Email tracking completed successfully');
  });

  test('Application Analytics and Insights', async ({ page }) => {
    console.log('🧪 Testing application analytics...');
    
    await TestHelpers.loginAsTestUser(page, 'premium.user@test.com');
    await page.goto('/dashboard');
    
    // Navigate to analytics section
    await page.click('[data-testid="tab-analytics"]');
    await expect(page.locator('[data-testid="analytics-dashboard"]')).toBeVisible();
    
    // Verify application statistics cards
    await expect(page.locator('[data-testid="stat-total-applications"]')).toBeVisible();
    await expect(page.locator('[data-testid="stat-response-rate"]')).toBeVisible();
    await expect(page.locator('[data-testid="stat-interview-rate"]')).toBeVisible();
    await expect(page.locator('[data-testid="stat-success-rate"]')).toBeVisible();
    
    // Verify charts are present
    await expect(page.locator('[data-testid="applications-timeline-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="status-distribution-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="response-time-chart"]')).toBeVisible();
    
    // Test date range filter
    await page.click('[data-testid="date-range-selector"]');
    await page.click('[data-testid="range-last-30-days"]');
    
    // Wait for analytics to reload
    await page.waitForSelector('[data-testid="analytics-loading"]', { state: 'hidden' });
    
    // Verify insights section
    await expect(page.locator('[data-testid="insights-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="insight-item"]')).toHaveCount.greaterThan(0);
    
    // Test insights interaction
    const firstInsight = page.locator('[data-testid="insight-item"]').first();
    await firstInsight.click();
    
    await expect(page.locator('[data-testid="insight-details-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="insight-explanation"]')).toBeVisible();
    await expect(page.locator('[data-testid="insight-recommendations"]')).toBeVisible();

    console.log('✅ Application analytics completed successfully');
  });

  test('Application Notes and Documentation', async ({ page }) => {
    console.log('🧪 Testing application notes and documentation...');
    
    await TestHelpers.loginAsTestUser(page);
    await TestHelpers.goToApplications(page);
    
    // Select application to add notes
    const firstApplication = page.locator('[data-testid="application-item"]').first();
    await firstApplication.click();
    
    await expect(page.locator('[data-testid="application-details-modal"]')).toBeVisible();
    
    // Navigate to notes section
    await page.click('[data-testid="tab-notes"]');
    await expect(page.locator('[data-testid="notes-section"]')).toBeVisible();
    
    // Add a new note
    await page.click('[data-testid="button-add-note"]');
    await expect(page.locator('[data-testid="note-editor"]')).toBeVisible();
    
    const noteContent = 'Researched company culture - great emphasis on work-life balance. Need to prepare questions about their development process.';
    await page.fill('[data-testid="textarea-note-content"]', noteContent);
    await page.selectOption('[data-testid="select-note-type"]', 'research');
    await page.click('[data-testid="button-save-note"]');
    
    // Verify note was added
    await expect(page.locator('[data-testid="note-item"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="note-content"]')).toContainText('work-life balance');
    await expect(page.locator('[data-testid="note-type-badge"]')).toContainText('Research');
    
    // Add interview preparation note
    await page.click('[data-testid="button-add-note"]');
    await page.fill('[data-testid="textarea-note-content"]', 'Technical interview prep:\n- Review React hooks\n- Practice system design\n- Prepare questions about team structure');
    await page.selectOption('[data-testid="select-note-type"]', 'interview_prep');
    await page.click('[data-testid="button-save-note"]');
    
    // Verify second note
    await expect(page.locator('[data-testid="note-item"]')).toHaveCount(2);
    
    // Test note editing
    const firstNote = page.locator('[data-testid="note-item"]').first();
    await firstNote.locator('[data-testid="button-edit-note"]').click();
    
    await page.fill('[data-testid="textarea-note-content"]', noteContent + '\n\nUpdate: Found great Glassdoor reviews about the team!');
    await page.click('[data-testid="button-save-note"]');
    
    await expect(page.locator('[data-testid="note-content"]').first()).toContainText('Glassdoor reviews');

    console.log('✅ Application notes and documentation completed successfully');
  });

  test('Interview Preparation and Scheduling', async ({ page }) => {
    console.log('🧪 Testing interview preparation features...');
    
    await TestHelpers.loginAsTestUser(page);
    await TestHelpers.goToApplications(page);
    
    // Select application for interview preparation
    const applicationItem = page.locator('[data-testid="application-item"]').first();
    await applicationItem.click();
    
    await expect(page.locator('[data-testid="application-details-modal"]')).toBeVisible();
    
    // Navigate to interview preparation section
    await page.click('[data-testid="tab-interview-prep"]');
    await expect(page.locator('[data-testid="interview-prep-section"]')).toBeVisible();
    
    // Start interview preparation
    await page.click('[data-testid="button-start-interview-prep"]');
    await expect(page.locator('[data-testid="prep-modal"]')).toBeVisible();
    
    // Verify preparation checklist
    const checklistItems = page.locator('[data-testid="prep-checklist-item"]');
    await expect(checklistItems).toHaveCount.greaterThan(0);
    
    // Complete checklist items
    await checklistItems.first().locator('[data-testid="checkbox-prep-item"]').check();
    await expect(page.locator('[data-testid="prep-progress"]')).toBeVisible();
    
    // Access AI-generated interview questions
    await page.click('[data-testid="button-practice-questions"]');
    await expect(page.locator('[data-testid="practice-questions-section"]')).toBeVisible();
    
    await expect(page.locator('[data-testid="practice-question"]')).toHaveCount.greaterThan(0);
    
    // Test answering practice question
    const firstQuestion = page.locator('[data-testid="practice-question"]').first();
    await firstQuestion.locator('[data-testid="button-start-answer"]').click();
    
    await page.fill('[data-testid="textarea-practice-answer"]', 'I would approach this by first understanding the requirements...');
    await page.click('[data-testid="button-submit-practice-answer"]');
    
    // Schedule interview reminder
    await page.click('[data-testid="button-schedule-reminder"]');
    
    const interviewDate = new Date();
    interviewDate.setDate(interviewDate.getDate() + 2);
    const dateStr = interviewDate.toISOString().split('T')[0];
    
    await page.fill('[data-testid="input-reminder-date"]', dateStr);
    await page.fill('[data-testid="input-reminder-time"]', '10:00');
    await page.selectOption('[data-testid="select-reminder-type"]', 'email');
    await page.click('[data-testid="button-save-reminder"]');
    
    await expect(page.locator('[data-testid="toast-message"]')).toContainText('Reminder scheduled');

    console.log('✅ Interview preparation completed successfully');
  });

  test('Application Performance Metrics', async ({ page }) => {
    console.log('🧪 Testing application performance metrics...');
    
    await TestHelpers.loginAsTestUser(page, 'premium.user@test.com');
    await page.goto('/dashboard');
    
    // Navigate to performance metrics
    await page.click('[data-testid="tab-performance"]');
    await expect(page.locator('[data-testid="performance-dashboard"]')).toBeVisible();
    
    // Verify key metrics
    await expect(page.locator('[data-testid="avg-response-time"]')).toBeVisible();
    await expect(page.locator('[data-testid="interview-conversion-rate"]')).toBeVisible();
    await expect(page.locator('[data-testid="application-velocity"]')).toBeVisible();
    
    // Test metric drill-down
    await page.click('[data-testid="metric-response-rate"]');
    await expect(page.locator('[data-testid="response-rate-details"]')).toBeVisible();
    
    // Verify breakdown by job type/company size
    await expect(page.locator('[data-testid="breakdown-by-job-type"]')).toBeVisible();
    await expect(page.locator('[data-testid="breakdown-by-company-size"]')).toBeVisible();
    
    // Check recommendations based on performance
    await expect(page.locator('[data-testid="performance-recommendations"]')).toBeVisible();
    const recommendations = page.locator('[data-testid="recommendation-item"]');
    await expect(recommendations).toHaveCount.greaterThan(0);
    
    // Test time period comparison
    await page.click('[data-testid="button-compare-periods"]');
    await page.selectOption('[data-testid="select-comparison-period"]', 'last-month');
    await page.click('[data-testid="button-apply-comparison"]');
    
    await page.waitForSelector('[data-testid="comparison-chart"]');
    await expect(page.locator('[data-testid="comparison-metrics"]')).toBeVisible();

    console.log('✅ Application performance metrics completed successfully');
  });

  test('Bulk Application Management', async ({ page }) => {
    console.log('🧪 Testing bulk application management...');
    
    await TestHelpers.loginAsTestUser(page);
    await TestHelpers.goToApplications(page);
    
    // Enter bulk selection mode
    await page.click('[data-testid="button-bulk-select"]');
    await expect(page.locator('[data-testid="bulk-selection-bar"]')).toBeVisible();
    
    // Select multiple applications
    const applicationItems = page.locator('[data-testid="application-item"]');
    await applicationItems.first().locator('[data-testid="checkbox-select-app"]').check();
    await applicationItems.nth(1).locator('[data-testid="checkbox-select-app"]').check();
    
    await expect(page.locator('[data-testid="selected-count"]')).toContainText('2 selected');
    
    // Test bulk status update
    await page.click('[data-testid="button-bulk-status-update"]');
    await page.selectOption('[data-testid="select-bulk-status"]', 'withdrawn');
    await page.fill('[data-testid="textarea-bulk-notes"]', 'Decided to focus on other opportunities');
    await page.click('[data-testid="button-confirm-bulk-update"]');
    
    await expect(page.locator('[data-testid="toast-message"]')).toContainText('Applications updated');
    
    // Test bulk export
    await page.click('[data-testid="button-select-all"]');
    await page.click('[data-testid="button-bulk-export"]');
    await page.selectOption('[data-testid="select-export-format"]', 'csv');
    await page.click('[data-testid="button-confirm-export"]');
    
    // Wait for download to complete
    const downloadPromise = page.waitForEvent('download');
    await downloadPromise;
    
    await expect(page.locator('[data-testid="toast-message"]')).toContainText('Export completed');

    console.log('✅ Bulk application management completed successfully');
  });
});