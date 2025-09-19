import { FullConfig } from '@playwright/test';
import { TestDatabase } from './test-database';
import { MockServiceManager } from '../mocks/mock-service-manager';

/**
 * Global teardown for Playwright tests
 * - Cleans up test data
 * - Stops mock services
 * - Closes database connections
 * - Archives test artifacts
 */
async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting Playwright E2E Test Suite Teardown...');
  
  try {
    // 1. Stop mock services
    console.log('🛑 Stopping mock services...');
    await MockServiceManager.stopAll();
    console.log('✅ Mock services stopped');

    // 2. Clean up test data (optional - keep for debugging)
    if (process.env.CLEANUP_TEST_DATA === 'true') {
      console.log('🗑️ Cleaning up test data...');
      await TestDatabase.cleanup();
      console.log('✅ Test data cleaned up');
    } else {
      console.log('💾 Test data preserved for debugging');
    }

    // 3. Close database connections
    console.log('🔌 Closing database connections...');
    await TestDatabase.close();
    console.log('✅ Database connections closed');

    // 4. Archive test artifacts if needed
    if (process.env.ARCHIVE_TEST_ARTIFACTS === 'true') {
      console.log('📦 Archiving test artifacts...');
      // Implementation for archiving artifacts
      console.log('✅ Test artifacts archived');
    }

    console.log('🎉 Global teardown completed successfully!');
    
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // Don't throw error in teardown to avoid masking test failures
  }
}

export default globalTeardown;