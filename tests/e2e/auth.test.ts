import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';
import { TestDatabase } from '../fixtures/test-database';
import { TestDataSeeder } from '../fixtures/test-data-seeder';

test.describe('Authentication Flow Tests', () => {
  
  test.beforeEach(async () => {
    // Start with fresh test data
    await TestHelpers.seedFreshTestData();
  });

  test.afterEach(async ({ page }) => {
    // Take screenshot on failure
    if (test.info().status === 'failed') {
      await TestHelpers.takeScreenshot(page, `auth-failure-${test.info().title}`);
    }
  });

  test('User Registration Flow - New User Signup', async ({ page }) => {
    console.log('🧪 Testing user registration flow...');
    
    const testUser = {
      firstName: 'New',
      lastName: 'Tester',
      email: TestHelpers.generateTestEmail(),
      password: 'SecurePassword123!'
    };

    // Navigate to signup page
    await page.goto('/');
    await page.click('[data-testid="link-signup"]');
    
    // Verify signup form is displayed
    await expect(page.locator('[data-testid="form-signup"]')).toBeVisible();
    await expect(page.locator('h1')).toContainText('Create Account');

    // Fill registration form
    await TestHelpers.fillForm(page, {
      'first-name': testUser.firstName,
      'last-name': testUser.lastName,
      'email': testUser.email,
      'password': testUser.password,
      'confirm-password': testUser.password
    });

    // Submit registration
    await page.click('[data-testid="button-register"]');

    // Wait for successful registration and redirect
    await page.waitForURL('/dashboard');
    await expect(page.locator('[data-testid="welcome-message"]')).toContainText('Welcome');

    // Verify user menu is visible (logged in state)
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();

    // Verify user was created in database
    const createdUser = await TestHelpers.getCurrentUser(testUser.email);
    expect(createdUser).toBeTruthy();
    expect(createdUser.firstName).toBe(testUser.firstName);
    expect(createdUser.lastName).toBe(testUser.lastName);
    expect(createdUser.plan).toBe('Free');

    // Verify database state
    await TestHelpers.verifyDatabaseState({
      users: 5, // 4 seeded + 1 new user
      auth_accounts: 5 // 4 seeded + 1 new auth account
    });

    console.log('✅ User registration flow completed successfully');
  });

  test('User Login Flow - Existing User', async ({ page }) => {
    console.log('🧪 Testing user login flow...');
    
    const testUser = TestDataSeeder.getTestDataIds().users;
    const loginEmail = 'john.doe@test.com';

    // Navigate to login page
    await page.goto('/');
    await page.click('[data-testid="link-login"]');
    
    // Verify login form is displayed
    await expect(page.locator('[data-testid="form-login"]')).toBeVisible();
    await expect(page.locator('h1')).toContainText('Sign In');

    // Fill login credentials
    await page.fill('[data-testid="input-email"]', loginEmail);
    await page.fill('[data-testid="input-password"]', 'testpassword123');

    // Submit login
    await page.click('[data-testid="button-login"]');

    // Wait for successful login and redirect
    await page.waitForURL('/dashboard');
    
    // Verify dashboard is loaded
    await expect(page.locator('[data-testid="dashboard-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();

    // Verify user info is displayed correctly
    await page.click('[data-testid="user-menu"]');
    await expect(page.locator('[data-testid="user-name"]')).toContainText('John Doe');
    await expect(page.locator('[data-testid="user-email"]')).toContainText(loginEmail);
    
    console.log('✅ User login flow completed successfully');
  });

  test('User Logout Flow', async ({ page }) => {
    console.log('🧪 Testing user logout flow...');
    
    // Login first
    await TestHelpers.loginAsTestUser(page);
    
    // Verify logged in state
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();

    // Logout
    await TestHelpers.logout(page);

    // Verify logged out state
    await expect(page.locator('[data-testid="link-login"]')).toBeVisible();
    await expect(page.locator('[data-testid="link-signup"]')).toBeVisible();

    // Try to access protected route
    await page.goto('/dashboard');
    
    // Should redirect to login
    await page.waitForURL('/login');
    await expect(page.locator('[data-testid="form-login"]')).toBeVisible();

    console.log('✅ User logout flow completed successfully');
  });

  test('Session Management - Persistent Login', async ({ page, context }) => {
    console.log('🧪 Testing session persistence...');
    
    // Login
    await TestHelpers.loginAsTestUser(page);
    
    // Close page and open new one (simulating browser restart)
    await page.close();
    const newPage = await context.newPage();
    
    // Navigate to dashboard
    await newPage.goto('/dashboard');
    
    // Should still be logged in
    await expect(newPage.locator('[data-testid="user-menu"]')).toBeVisible({ timeout: 10000 });
    
    console.log('✅ Session persistence test completed successfully');
  });

  test('Login Validation - Invalid Credentials', async ({ page }) => {
    console.log('🧪 Testing login validation with invalid credentials...');
    
    await page.goto('/login');
    
    // Test invalid email format
    await page.fill('[data-testid="input-email"]', 'invalid-email');
    await page.fill('[data-testid="input-password"]', 'password123');
    await page.click('[data-testid="button-login"]');
    
    // Should show validation error
    await expect(page.locator('[data-testid="error-email"]')).toContainText('valid email');
    
    // Test wrong password
    await page.fill('[data-testid="input-email"]', 'john.doe@test.com');
    await page.fill('[data-testid="input-password"]', 'wrongpassword');
    await page.click('[data-testid="button-login"]');
    
    // Should show authentication error
    await expect(page.locator('[data-testid="error-login"]')).toContainText('Invalid credentials');
    
    // Test non-existent user
    await page.fill('[data-testid="input-email"]', 'nonexistent@test.com');
    await page.fill('[data-testid="input-password"]', 'password123');
    await page.click('[data-testid="button-login"]');
    
    // Should show authentication error
    await expect(page.locator('[data-testid="error-login"]')).toContainText('Invalid credentials');

    console.log('✅ Login validation test completed successfully');
  });

  test('Registration Validation - Form Validation', async ({ page }) => {
    console.log('🧪 Testing registration form validation...');
    
    await page.goto('/signup');
    
    // Test empty form submission
    await page.click('[data-testid="button-register"]');
    
    // Should show validation errors
    await expect(page.locator('[data-testid="error-first-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-email"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-password"]')).toBeVisible();
    
    // Test password mismatch
    await TestHelpers.fillForm(page, {
      'first-name': 'Test',
      'last-name': 'User',
      'email': 'test@example.com',
      'password': 'password123',
      'confirm-password': 'differentpassword'
    });
    
    await page.click('[data-testid="button-register"]');
    await expect(page.locator('[data-testid="error-confirm-password"]')).toContainText('Passwords must match');
    
    // Test weak password
    await page.fill('[data-testid="input-password"]', '123');
    await page.fill('[data-testid="input-confirm-password"]', '123');
    await page.click('[data-testid="button-register"]');
    
    await expect(page.locator('[data-testid="error-password"]')).toContainText('Password must be');
    
    // Test existing email
    await TestHelpers.fillForm(page, {
      'first-name': 'Test',
      'last-name': 'User',
      'email': 'john.doe@test.com', // Existing user
      'password': 'SecurePassword123!',
      'confirm-password': 'SecurePassword123!'
    });
    
    await page.click('[data-testid="button-register"]');
    await expect(page.locator('[data-testid="error-email"]')).toContainText('already exists');

    console.log('✅ Registration validation test completed successfully');
  });

  test('Rate Limiting - Multiple Failed Attempts', async ({ page }) => {
    console.log('🧪 Testing rate limiting on failed login attempts...');
    
    await page.goto('/login');
    
    // Attempt multiple failed logins
    for (let i = 0; i < 6; i++) {
      await page.fill('[data-testid="input-email"]', 'john.doe@test.com');
      await page.fill('[data-testid="input-password"]', 'wrongpassword');
      await page.click('[data-testid="button-login"]');
      
      if (i < 4) {
        // First few attempts should show normal error
        await expect(page.locator('[data-testid="error-login"]')).toContainText('Invalid credentials');
      } else {
        // After 5 attempts, should show rate limit error
        await expect(page.locator('[data-testid="error-rate-limit"]')).toContainText('Too many attempts');
        break;
      }
      
      // Small delay between attempts
      await page.waitForTimeout(500);
    }

    console.log('✅ Rate limiting test completed successfully');
  });

  test('Authentication State Changes - User Plan Upgrade', async ({ page }) => {
    console.log('🧪 Testing authentication state with plan changes...');
    
    // Login as free user
    await TestHelpers.loginAsTestUser(page, 'john.doe@test.com');
    
    // Verify free plan status
    await page.click('[data-testid="user-menu"]');
    await expect(page.locator('[data-testid="user-plan"]')).toContainText('Free');
    await expect(page.locator('[data-testid="user-credits"]')).toContainText('5 credits');
    
    // Navigate to billing (should show upgrade options)
    await page.goto('/billing');
    await expect(page.locator('[data-testid="upgrade-premium"]')).toBeVisible();
    
    // Simulate plan upgrade in database (would normally happen via payment webhook)
    const user = await TestHelpers.getCurrentUser('john.doe@test.com');
    const db = TestDatabase.getDb();
    await db.update(schema.users)
      .set({ plan: 'Premium', creditsRemaining: 50 })
      .where(eq(schema.users.id, user.id));
    
    // Refresh page to pick up changes
    await page.reload();
    
    // Verify updated plan status
    await page.click('[data-testid="user-menu"]');
    await expect(page.locator('[data-testid="user-plan"]')).toContainText('Premium');
    await expect(page.locator('[data-testid="user-credits"]')).toContainText('50 credits');

    console.log('✅ Authentication state changes test completed successfully');
  });

  test('Cross-Device Login - Multiple Sessions', async ({ page, context }) => {
    console.log('🧪 Testing cross-device login functionality...');
    
    // Login on first device (page)
    await TestHelpers.loginAsTestUser(page);
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    
    // Simulate second device (new context)
    const secondDevice = await context.newPage();
    
    // Login on second device with same credentials
    await TestHelpers.loginAsTestUser(secondDevice);
    await expect(secondDevice.locator('[data-testid="user-menu"]')).toBeVisible();
    
    // Both sessions should remain active
    await page.goto('/dashboard');
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    
    await secondDevice.goto('/dashboard');
    await expect(secondDevice.locator('[data-testid="user-menu"]')).toBeVisible();
    
    // Logout from one device
    await TestHelpers.logout(page);
    
    // Other session should still be active
    await secondDevice.reload();
    await expect(secondDevice.locator('[data-testid="user-menu"]')).toBeVisible();

    console.log('✅ Cross-device login test completed successfully');
  });
});