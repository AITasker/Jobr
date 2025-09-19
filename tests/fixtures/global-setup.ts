import { chromium, FullConfig } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';
import { TestDatabase } from './test-database';
import { TestDataSeeder } from './test-data-seeder';
import { MockServiceManager } from '../mocks/mock-service-manager';

const execAsync = promisify(exec);

/**
 * Global setup for Playwright tests
 * - Sets up test database
 * - Seeds test data
 * - Starts mock services
 * - Prepares test environment
 */
async function globalSetup(config: FullConfig) {
  console.log('🧪 Starting Playwright E2E Test Suite Setup...');
  
  try {
    // 1. Initialize test database
    console.log('📊 Setting up test database...');
    await TestDatabase.setup();
    console.log('✅ Test database ready');

    // 2. Run database migrations if needed
    console.log('🔄 Running database migrations...');
    try {
      await execAsync('npm run db:push');
      console.log('✅ Database migrations complete');
    } catch (error) {
      console.warn('⚠️ Database migration warning:', error);
      // Continue even if migrations have issues in test environment
    }

    // 3. Seed test data
    console.log('🌱 Seeding test data...');
    await TestDataSeeder.seedAll();
    console.log('✅ Test data seeded successfully');

    // 4. Start mock services
    console.log('🎭 Starting mock services...');
    await MockServiceManager.startAll();
    console.log('✅ Mock services running');

    // 5. Verify application is reachable
    console.log('🌐 Verifying application availability...');
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    try {
      // Wait for the application to be ready
      const maxRetries = 30;
      let retries = 0;
      let appReady = false;
      
      while (retries < maxRetries && !appReady) {
        try {
          await page.goto(config.projects[0].use?.baseURL || 'http://localhost:5000', {
            waitUntil: 'domcontentloaded',
            timeout: 3000
          });
          appReady = true;
          console.log('✅ Application is ready');
        } catch (error) {
          retries++;
          console.log(`⏳ Waiting for application... (${retries}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      if (!appReady) {
        throw new Error('Application failed to start within timeout period');
      }

    } finally {
      await browser.close();
    }

    // 6. Set global test context
    process.env.PLAYWRIGHT_TEST_SETUP_COMPLETE = 'true';
    
    console.log('🎉 Global setup completed successfully!');
    console.log('📋 Test Environment Summary:');
    console.log(`   - Database: ${process.env.TEST_DATABASE_URL || process.env.DATABASE_URL}`);
    console.log(`   - Base URL: ${config.projects[0].use?.baseURL}`);
    console.log(`   - Mock Services: Active`);
    console.log(`   - Test Data: Seeded`);
    
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  }
}

export default globalSetup;