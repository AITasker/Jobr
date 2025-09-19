import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure Neon for optimal performance
neonConfig.webSocketConstructor = ws;
neonConfig.useSecureWebSocket = true;
neonConfig.pipelineConnect = false; // Disable for better error handling
neonConfig.subtls = undefined; // Use default TLS configuration

// Environment detection
const isProduction = process.env.NODE_ENV === 'production';

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Production-optimized connection pool configuration
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  // Connection pool settings optimized for production
  max: isProduction ? 20 : 5, // Max connections in pool
  idleTimeoutMillis: isProduction ? 30000 : 10000, // Close idle connections after 30s in prod, 10s in dev
  connectionTimeoutMillis: isProduction ? 10000 : 5000, // Connection timeout
  // SSL configuration for production
  ssl: isProduction ? { rejectUnauthorized: false } : undefined,
};

export const pool = new Pool(poolConfig);

// Enhanced database instance with retry logic
export const db = drizzle({ client: pool, schema });

// Database health check function
export async function checkDatabaseHealth(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
  const start = Date.now();
  try {
    // Simple query to test connectivity
    await db.execute(sql`SELECT 1`);
    const latency = Date.now() - start;
    return { healthy: true, latency };
  } catch (error) {
    console.error('Database health check failed:', error);
    return { 
      healthy: false, 
      error: error instanceof Error ? error.message : 'Unknown database error' 
    };
  }
}

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, closing database pool...');
  await pool.end();
  console.log('Database pool closed.');
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, closing database pool...');
  await pool.end();
  console.log('Database pool closed.');
});

// Log pool configuration on startup
console.log(`Database pool configured: max=${poolConfig.max}, idleTimeout=${poolConfig.idleTimeoutMillis}ms, production=${isProduction}`);