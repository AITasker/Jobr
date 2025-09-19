import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../../shared/schema';

/**
 * Test Database Management
 * Handles database setup, cleanup, and test isolation
 */
export class TestDatabase {
  private static pool: Pool | null = null;
  private static db: ReturnType<typeof drizzle> | null = null;

  /**
   * Initialize test database connection
   */
  static async setup(): Promise<void> {
    const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set for testing');
    }

    this.pool = new Pool({ connectionString: databaseUrl });
    this.db = drizzle({ client: this.pool, schema });

    // Verify connection
    try {
      await this.pool.query('SELECT 1');
      console.log('📊 Test database connection established');
    } catch (error) {
      throw new Error(`Failed to connect to test database: ${error}`);
    }
  }

  /**
   * Get database instance
   */
  static getDb() {
    if (!this.db) {
      throw new Error('Test database not initialized. Call setup() first.');
    }
    return this.db;
  }

  /**
   * Clean up test data
   * Removes all test data while preserving schema
   */
  static async cleanup(): Promise<void> {
    if (!this.db || !this.pool) {
      return;
    }

    try {
      // Clean up in reverse dependency order to avoid foreign key constraints
      await this.pool.query('TRUNCATE TABLE application_analytics RESTART IDENTITY CASCADE');
      await this.pool.query('TRUNCATE TABLE employer_interactions RESTART IDENTITY CASCADE');
      await this.pool.query('TRUNCATE TABLE application_notifications RESTART IDENTITY CASCADE');
      await this.pool.query('TRUNCATE TABLE application_documents RESTART IDENTITY CASCADE');
      await this.pool.query('TRUNCATE TABLE email_events RESTART IDENTITY CASCADE');
      await this.pool.query('TRUNCATE TABLE application_history RESTART IDENTITY CASCADE');
      await this.pool.query('TRUNCATE TABLE applications RESTART IDENTITY CASCADE');
      await this.pool.query('TRUNCATE TABLE job_alerts RESTART IDENTITY CASCADE');
      await this.pool.query('TRUNCATE TABLE user_preferences RESTART IDENTITY CASCADE');
      await this.pool.query('TRUNCATE TABLE job_bookmarks RESTART IDENTITY CASCADE');
      await this.pool.query('TRUNCATE TABLE saved_searches RESTART IDENTITY CASCADE');
      await this.pool.query('TRUNCATE TABLE search_history RESTART IDENTITY CASCADE');
      await this.pool.query('TRUNCATE TABLE payment_requests RESTART IDENTITY CASCADE');
      await this.pool.query('TRUNCATE TABLE stripe_events RESTART IDENTITY CASCADE');
      await this.pool.query('TRUNCATE TABLE otp_codes RESTART IDENTITY CASCADE');
      await this.pool.query('TRUNCATE TABLE auth_accounts RESTART IDENTITY CASCADE');
      await this.pool.query('TRUNCATE TABLE templates RESTART IDENTITY CASCADE');
      await this.pool.query('TRUNCATE TABLE api_usage RESTART IDENTITY CASCADE');
      await this.pool.query('TRUNCATE TABLE subscriptions RESTART IDENTITY CASCADE');
      await this.pool.query('TRUNCATE TABLE jobs RESTART IDENTITY CASCADE');
      await this.pool.query('TRUNCATE TABLE cvs RESTART IDENTITY CASCADE');
      await this.pool.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
      await this.pool.query('TRUNCATE TABLE sessions RESTART IDENTITY CASCADE');
      
      console.log('🗑️ Test database cleaned successfully');
    } catch (error) {
      console.error('❌ Failed to clean test database:', error);
      throw error;
    }
  }

  /**
   * Close database connections
   */
  static async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.db = null;
      console.log('🔌 Test database connections closed');
    }
  }

  /**
   * Reset database to clean state for test isolation
   */
  static async reset(): Promise<void> {
    await this.cleanup();
    // Re-seed minimal data if needed
    console.log('🔄 Test database reset complete');
  }

  /**
   * Execute raw SQL query for test utilities
   */
  static async query(sql: string, params?: any[]): Promise<any> {
    if (!this.pool) {
      throw new Error('Test database not initialized');
    }
    return this.pool.query(sql, params);
  }

  /**
   * Get current database statistics for test verification
   */
  static async getStats(): Promise<Record<string, number>> {
    if (!this.pool) {
      throw new Error('Test database not initialized');
    }

    const stats: Record<string, number> = {};
    const tables = [
      'users', 'sessions', 'cvs', 'jobs', 'applications', 
      'subscriptions', 'api_usage', 'templates', 'auth_accounts',
      'otp_codes', 'stripe_events', 'payment_requests',
      'saved_searches', 'search_history', 'job_bookmarks',
      'user_preferences', 'job_alerts', 'application_history',
      'email_events', 'application_documents', 'application_notifications',
      'employer_interactions', 'application_analytics'
    ];

    for (const table of tables) {
      try {
        const result = await this.pool.query(`SELECT COUNT(*) as count FROM ${table}`);
        stats[table] = parseInt(result.rows[0].count);
      } catch (error) {
        console.warn(`⚠️ Could not get count for table ${table}:`, error);
        stats[table] = 0;
      }
    }

    return stats;
  }
}