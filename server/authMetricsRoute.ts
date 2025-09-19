import type { Express } from "express";
import { AuthMonitor } from "./authMonitor";
import { isAuthenticated } from "./replitAuth";
import { storage } from "./storage";

/**
 * Check if user is admin based on environment configuration
 */
function isAdmin(userEmail: string): boolean {
  const adminEmails = process.env.ADMIN_EMAILS;
  if (!adminEmails) {
    // If no admin emails configured, check for specific admin env flag
    return process.env.ALLOW_ALL_METRICS_ACCESS === 'true';
  }
  
  return adminEmails.split(',').map(email => email.trim().toLowerCase()).includes(userEmail.toLowerCase());
}

/**
 * Add authentication metrics endpoint to the Express app
 */
export function addAuthMetricsRoute(app: Express): void {
  // Authentication metrics endpoint (admin-only access)
  app.get('/api/auth/metrics', isAuthenticated, async (req: any, res) => {
    try {
      // Get user info from authenticated request
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !user.email) {
        return res.status(401).json({
          message: "User not found",
          code: "USER_NOT_FOUND"
        });
      }
      
      // Check if user is admin
      if (!isAdmin(user.email)) {
        return res.status(403).json({
          message: "Access denied. Admin privileges required to view authentication metrics.",
          code: "ADMIN_ACCESS_REQUIRED"
        });
      }
      
      const hours = parseInt(req.query.hours as string) || 24;
      const metrics = await AuthMonitor.getAuthMetrics(hours);
      
      res.json({
        success: true,
        metrics,
        period: `${hours} hours`,
        timestamp: new Date().toISOString(),
        admin_user: user.email
      });
    } catch (error) {
      console.error("Auth metrics error:", error);
      res.status(500).json({
        message: "Failed to fetch authentication metrics",
        code: "METRICS_ERROR"
      });
    }
  });

  // Account lockout status endpoint
  app.get('/api/auth/lockout-status', async (req, res) => {
    try {
      const email = req.query.email as string;
      
      if (!email) {
        return res.status(400).json({
          message: "Email parameter is required",
          code: "VALIDATION_ERROR"
        });
      }

      const lockoutInfo = AuthMonitor.getLockoutInfo(email);
      
      res.json({
        success: true,
        email,
        locked: lockoutInfo.locked,
        attemptsRemaining: lockoutInfo.attemptsRemaining,
        lockedUntil: lockoutInfo.lockedUntil?.toISOString(),
        canRetryAt: lockoutInfo.lockedUntil?.toISOString()
      });
    } catch (error) {
      console.error("Lockout status error:", error);
      res.status(500).json({
        message: "Failed to check lockout status",
        code: "LOCKOUT_CHECK_ERROR"
      });
    }
  });
}