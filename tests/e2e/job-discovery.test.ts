import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';
import { TestDataSeeder } from '../fixtures/test-data-seeder';

test.describe('Job Discovery and Application Tests', () => {
  
  test.beforeEach(async () => {
    await TestHelpers.seedFreshTestData();
  });

  test.afterEach(async ({ page }) => {
    if (test.info().status === 'failed') {
      await TestHelpers.takeScreenshot(page, `job-discovery-failure-${test.info().title}`);
    }
  });

  test('Job Search and Filter Functionality', async ({ page }) => {
    console.log('🧪 Testing job search and filtering...');
    
    await TestHelpers.loginAsTestUser(page);
    await TestHelpers.uploadTestCV(page);

    // Navigate to jobs tab
    await page.click('[data-testid="tab-jobs"]');
    await expect(page.locator('[data-testid="jobs-section"]')).toBeVisible();

    // Verify initial job listings are displayed
    await expect(page.locator('[data-testid="job-card"]')).toHaveCount.greaterThan(0);

    // Test basic search
    await page.fill('[data-testid="input-job-search"]', 'Frontend Developer');
    await page.click('[data-testid="button-search-jobs"]');
    
    await page.waitForSelector('[data-testid="job-search-results"]');
    const frontendJobs = page.locator('[data-testid="job-card"][data-job-title*="Frontend"]');
    await expect(frontendJobs).toHaveCount.greaterThan(0);

    // Test location filter
    await page.fill('[data-testid="input-location-filter"]', 'San Francisco');
    await page.click('[data-testid="button-search-jobs"]');
    
    await page.waitForSelector('[data-testid="job-search-results"]');
    const sfJobs = page.locator('[data-testid="job-card"][data-job-location*="San Francisco"]');
    await expect(sfJobs).toHaveCount.greaterThan(0);

    // Test remote filter
    await page.check('[data-testid="checkbox-remote-only"]');
    await page.click('[data-testid="button-search-jobs"]');
    
    await page.waitForSelector('[data-testid="job-search-results"]');
    const remoteJobs = page.locator('[data-testid="job-card"][data-job-type="Remote"]');
    await expect(remoteJobs).toHaveCount.greaterThan(0);

    // Test job type filter
    await page.selectOption('[data-testid="select-job-type"]', 'Full-time');
    await page.click('[data-testid="button-search-jobs"]');
    
    await page.waitForSelector('[data-testid="job-search-results"]');
    await expect(page.locator('[data-testid="filter-results-count"]')).toContainText('results');

    console.log('✅ Job search and filtering completed successfully');
  });

  test('Job Matching Display with AI Scores', async ({ page }) => {
    console.log('🧪 Testing AI-powered job matching display...');
    
    await TestHelpers.loginAsTestUser(page);
    await TestHelpers.uploadTestCV(page);

    // Trigger job matching
    await page.click('[data-testid="button-find-jobs"]');
    await expect(page.locator('[data-testid="job-matches"]')).toBeVisible({ timeout: 15000 });

    // Verify job cards with match scores
    const jobCards = page.locator('[data-testid="job-card"]');
    const firstJob = jobCards.first();
    
    // Verify match score is displayed
    await expect(firstJob.locator('[data-testid="match-score"]')).toBeVisible();
    const matchScore = await firstJob.locator('[data-testid="match-score-value"]').textContent();
    expect(parseInt(matchScore || '0')).toBeGreaterThan(0);

    // Verify match explanation
    await expect(firstJob.locator('[data-testid="match-explanation"]')).toBeVisible();
    await expect(firstJob.locator('[data-testid="match-explanation"]')).toContainText('match');

    // Check detailed match breakdown
    await firstJob.locator('[data-testid="button-view-match-details"]').click();
    await expect(page.locator('[data-testid="match-details-modal"]')).toBeVisible();

    // Skills match section
    await expect(page.locator('[data-testid="skills-match-score"]')).toBeVisible();
    await expect(page.locator('[data-testid="skills-matched-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="skills-missing-list"]')).toBeVisible();

    // Experience match section
    await expect(page.locator('[data-testid="experience-match-score"]')).toBeVisible();
    await expect(page.locator('[data-testid="experience-explanation"]')).toBeVisible();

    // Location match section
    await expect(page.locator('[data-testid="location-match-score"]')).toBeVisible();

    // Close modal
    await page.click('[data-testid="button-close-match-details"]');
    await expect(page.locator('[data-testid="match-details-modal"]')).not.toBeVisible();

    console.log('✅ Job matching display completed successfully');
  });

  test('Job Bookmarking and Saved Jobs', async ({ page }) => {
    console.log('🧪 Testing job bookmarking functionality...');
    
    await TestHelpers.loginAsTestUser(page);
    await page.goto('/dashboard');
    await page.click('[data-testid="tab-jobs"]');

    // Find first job and bookmark it
    const firstJobCard = page.locator('[data-testid="job-card"]').first();
    await firstJobCard.locator('[data-testid="button-bookmark-job"]').click();
    
    // Verify bookmark success message
    await expect(page.locator('[data-testid="toast-message"]')).toContainText('bookmarked');

    // Verify bookmark icon changes state
    await expect(firstJobCard.locator('[data-testid="icon-bookmarked"]')).toBeVisible();

    // Navigate to saved jobs
    await page.click('[data-testid="link-saved-jobs"]');
    await expect(page.locator('[data-testid="saved-jobs-list"]')).toBeVisible();
    
    // Verify saved job appears in list
    await expect(page.locator('[data-testid="saved-job-item"]')).toHaveCount(1);

    // Test removing bookmark
    const savedJob = page.locator('[data-testid="saved-job-item"]').first();
    await savedJob.locator('[data-testid="button-remove-bookmark"]').click();
    
    // Confirm removal
    await page.click('[data-testid="button-confirm-remove"]');
    await expect(page.locator('[data-testid="toast-message"]')).toContainText('removed');
    
    // Verify job is removed from saved list
    await expect(page.locator('[data-testid="saved-job-item"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="no-saved-jobs-message"]')).toBeVisible();

    console.log('✅ Job bookmarking completed successfully');
  });

  test('Job Application Submission Workflow', async ({ page }) => {
    console.log('🧪 Testing job application submission...');
    
    await TestHelpers.loginAsTestUser(page);
    await TestHelpers.uploadTestCV(page);
    
    // Navigate to jobs and find suitable job
    await page.click('[data-testid="tab-jobs"]');
    const targetJobCard = page.locator('[data-testid="job-card"]').first();
    const jobTitle = await targetJobCard.locator('[data-testid="job-title"]').textContent();
    
    // Click apply button
    await targetJobCard.locator('[data-testid="button-apply-job"]').click();
    
    // Wait for application modal
    await expect(page.locator('[data-testid="application-modal"]')).toBeVisible();
    
    // Verify application details
    await expect(page.locator('[data-testid="application-job-title"]')).toContainText(jobTitle || '');
    await expect(page.locator('[data-testid="application-cv-preview"]')).toBeVisible();
    
    // Check if cover letter generation is offered
    const generateCoverLetterBtn = page.locator('[data-testid="button-generate-cover-letter"]');
    if (await generateCoverLetterBtn.isVisible()) {
      await generateCoverLetterBtn.click();
      
      // Wait for AI cover letter generation
      await expect(page.locator('[data-testid="cover-letter-generating"]')).toBeVisible();
      await expect(page.locator('[data-testid="cover-letter-content"]')).toBeVisible({ timeout: 15000 });
    }
    
    // Submit application
    await page.click('[data-testid="button-submit-application"]');
    
    // Wait for application success
    await expect(page.locator('[data-testid="application-success"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="success-message"]')).toContainText('successfully applied');
    
    // Verify application appears in tracker
    await page.click('[data-testid="button-view-applications"]');
    await expect(page.locator('[data-testid="applications-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="application-item"]')).toHaveCount.greaterThan(0);
    
    // Verify application details
    const applicationItem = page.locator('[data-testid="application-item"]').first();
    await expect(applicationItem.locator('[data-testid="application-job-title"]')).toContainText(jobTitle || '');
    await expect(applicationItem.locator('[data-testid="application-status"]')).toContainText('Applied');
    await expect(applicationItem.locator('[data-testid="application-date"]')).toBeVisible();

    console.log('✅ Job application submission completed successfully');
  });

  test('Advanced Job Search with Salary Filters', async ({ page }) => {
    console.log('🧪 Testing advanced job search with salary filters...');
    
    await TestHelpers.loginAsTestUser(page);
    await page.click('[data-testid="tab-jobs"]');

    // Open advanced filters
    await page.click('[data-testid="button-advanced-filters"]');
    await expect(page.locator('[data-testid="advanced-filters-panel"]')).toBeVisible();

    // Set salary range
    const salaryRangeSlider = page.locator('[data-testid="salary-range-slider"]');
    await salaryRangeSlider.locator('[data-testid="slider-min"]').fill('100000');
    await salaryRangeSlider.locator('[data-testid="slider-max"]').fill('160000');

    // Set experience level
    await page.selectOption('[data-testid="select-experience-level"]', 'mid');

    // Set company size preference
    await page.selectOption('[data-testid="select-company-size"]', 'medium');

    // Apply advanced filters
    await page.click('[data-testid="button-apply-advanced-filters"]');
    await page.waitForSelector('[data-testid="job-search-results"]');

    // Verify filtered results
    const filteredJobs = page.locator('[data-testid="job-card"]');
    await expect(filteredJobs).toHaveCount.greaterThan(0);

    // Verify salary ranges in results match filter
    const firstJob = filteredJobs.first();
    const salaryText = await firstJob.locator('[data-testid="job-salary"]').textContent();
    expect(salaryText).toContain('$');

    // Save this search
    await page.click('[data-testid="button-save-search"]');
    await page.fill('[data-testid="input-search-name"]', 'Senior Frontend Roles');
    await page.click('[data-testid="button-confirm-save-search"]');
    
    await expect(page.locator('[data-testid="toast-message"]')).toContainText('Search saved');

    console.log('✅ Advanced job search completed successfully');
  });

  test('Job Comparison Feature', async ({ page }) => {
    console.log('🧪 Testing job comparison functionality...');
    
    await TestHelpers.loginAsTestUser(page);
    await page.click('[data-testid="tab-jobs"]');

    // Select multiple jobs for comparison
    const jobCards = page.locator('[data-testid="job-card"]');
    
    // Select first job
    await jobCards.nth(0).locator('[data-testid="checkbox-compare-job"]').check();
    await expect(page.locator('[data-testid="comparison-counter"]')).toContainText('1 selected');
    
    // Select second job
    await jobCards.nth(1).locator('[data-testid="checkbox-compare-job"]').check();
    await expect(page.locator('[data-testid="comparison-counter"]')).toContainText('2 selected');
    
    // Select third job
    await jobCards.nth(2).locator('[data-testid="checkbox-compare-job"]').check();
    await expect(page.locator('[data-testid="comparison-counter"]')).toContainText('3 selected');

    // Open comparison view
    await page.click('[data-testid="button-compare-jobs"]');
    await expect(page.locator('[data-testid="job-comparison-modal"]')).toBeVisible();

    // Verify comparison table
    await expect(page.locator('[data-testid="comparison-table"]')).toBeVisible();
    await expect(page.locator('[data-testid="comparison-job-column"]')).toHaveCount(3);

    // Verify comparison criteria
    await expect(page.locator('[data-testid="comparison-salary-row"]')).toBeVisible();
    await expect(page.locator('[data-testid="comparison-location-row"]')).toBeVisible();
    await expect(page.locator('[data-testid="comparison-company-row"]')).toBeVisible();
    await expect(page.locator('[data-testid="comparison-match-score-row"]')).toBeVisible();

    // Test removing job from comparison
    await page.locator('[data-testid="comparison-job-column"]').first().locator('[data-testid="button-remove-from-comparison"]').click();
    await expect(page.locator('[data-testid="comparison-job-column"]')).toHaveCount(2);

    // Close comparison
    await page.click('[data-testid="button-close-comparison"]');
    await expect(page.locator('[data-testid="job-comparison-modal"]')).not.toBeVisible();

    console.log('✅ Job comparison completed successfully');
  });

  test('Job Alert Setup and Management', async ({ page }) => {
    console.log('🧪 Testing job alert setup...');
    
    await TestHelpers.loginAsTestUser(page);
    await page.click('[data-testid="tab-jobs"]');

    // Set up search criteria
    await page.fill('[data-testid="input-job-search"]', 'React Developer');
    await page.fill('[data-testid="input-location-filter"]', 'Remote');
    await page.click('[data-testid="button-search-jobs"]');

    // Create job alert from current search
    await page.click('[data-testid="button-create-job-alert"]');
    await expect(page.locator('[data-testid="job-alert-modal"]')).toBeVisible();

    // Configure alert settings
    await page.fill('[data-testid="input-alert-name"]', 'Remote React Developer Jobs');
    await page.selectOption('[data-testid="select-alert-frequency"]', 'daily');
    await page.check('[data-testid="checkbox-alert-email"]');

    // Save alert
    await page.click('[data-testid="button-save-alert"]');
    await expect(page.locator('[data-testid="toast-message"]')).toContainText('Job alert created');

    // Navigate to manage alerts
    await page.click('[data-testid="link-manage-alerts"]');
    await expect(page.locator('[data-testid="job-alerts-list"]')).toBeVisible();

    // Verify alert appears in list
    const alertItem = page.locator('[data-testid="alert-item"]').first();
    await expect(alertItem.locator('[data-testid="alert-name"]')).toContainText('Remote React Developer');
    await expect(alertItem.locator('[data-testid="alert-frequency"]')).toContainText('daily');
    await expect(alertItem.locator('[data-testid="alert-status"]')).toContainText('Active');

    // Test disabling alert
    await alertItem.locator('[data-testid="toggle-alert-status"]').click();
    await expect(alertItem.locator('[data-testid="alert-status"]')).toContainText('Inactive');

    console.log('✅ Job alert setup completed successfully');
  });

  test('Personalized Job Recommendations', async ({ page }) => {
    console.log('🧪 Testing personalized job recommendations...');
    
    // Login as premium user with more data
    await TestHelpers.loginAsTestUser(page, 'premium.user@test.com');
    await page.goto('/dashboard');

    // Verify personalized recommendations section
    await expect(page.locator('[data-testid="personalized-recommendations"]')).toBeVisible();
    await expect(page.locator('[data-testid="recommendations-title"]')).toContainText('Recommended for you');

    // Verify recommendation cards
    const recommendationCards = page.locator('[data-testid="recommendation-card"]');
    await expect(recommendationCards).toHaveCount.greaterThan(0);

    // Check first recommendation
    const firstRecommendation = recommendationCards.first();
    await expect(firstRecommendation.locator('[data-testid="recommendation-reason"]')).toBeVisible();
    await expect(firstRecommendation.locator('[data-testid="recommendation-match-score"]')).toBeVisible();

    // Test recommendation interaction
    await firstRecommendation.locator('[data-testid="button-view-recommendation"]').click();
    await expect(page.locator('[data-testid="job-details-modal"]')).toBeVisible();

    // Verify recommendation explanation
    await expect(page.locator('[data-testid="why-recommended"]')).toBeVisible();
    await expect(page.locator('[data-testid="recommendation-explanation"]')).toContainText('based on');

    // Close modal
    await page.click('[data-testid="button-close-job-details"]');

    // Test dismissing recommendation
    await firstRecommendation.locator('[data-testid="button-dismiss-recommendation"]').click();
    await page.click('[data-testid="button-confirm-dismiss"]');
    
    await expect(page.locator('[data-testid="toast-message"]')).toContainText('Recommendation dismissed');

    console.log('✅ Personalized job recommendations completed successfully');
  });
});