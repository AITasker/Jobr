import { storage } from './storage';
import { AuthLogger, AUTH_ERRORS, ERROR_CODES } from './utils/errorHandler';

// Track failed login attempts and account lockouts
const LOGIN_ATTEMPTS = new Map<string, { count: number; lastAttempt: Date; lockedUntil?: Date }>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minutes

export interface AuthMetrics {
  totalLogins: number;
  successfulLogins: number;
  failedLogins: number;
  lockedAccounts: number;
  successRate: number;
  recentAttempts: Array<{
    timestamp: string;
    method: string;
    success: boolean;
    ip?: string;
    errorCode?: string;
  }>;
}

/**
 * Authentication monitoring and security service
 */
export class AuthMonitor {
  /**
   * Check if account is locked due to failed attempts
   */
  static isAccountLocked(email: string): boolean {
    const attempts = LOGIN_ATTEMPTS.get(email);
    if (!attempts) return false;

    if (attempts.lockedUntil && new Date() < attempts.lockedUntil) {
      return true;
    }

    // Clear expired lockout
    if (attempts.lockedUntil && new Date() >= attempts.lockedUntil) {
      LOGIN_ATTEMPTS.delete(email);
      return false;
    }

    return false;
  }

  /**
   * Record a failed login attempt
   */
  static recordFailedAttempt(email: string, ip?: string, userAgent?: string): boolean {
    const now = new Date();
    const attempts = LOGIN_ATTEMPTS.get(email) || { count: 0, lastAttempt: new Date(0) };

    // Reset count if last attempt was outside the window
    if (now.getTime() - attempts.lastAttempt.getTime() > ATTEMPT_WINDOW) {
      attempts.count = 0;
    }

    attempts.count++;
    attempts.lastAttempt = now;

    // Lock account if too many attempts
    if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
      attempts.lockedUntil = new Date(now.getTime() + LOCKOUT_DURATION);
      
      AuthLogger.logSecurityEvent('account_locked', {
        email,
        attempts: attempts.count,
        lockedUntil: attempts.lockedUntil.toISOString(),
        ip,
        userAgent
      });

      LOGIN_ATTEMPTS.set(email, attempts);
      return true; // Account is now locked
    }

    LOGIN_ATTEMPTS.set(email, attempts);
    
    AuthLogger.logAuthEvent({
      email,
      method: 'email',
      action: 'failed_attempt',
      ip,
      userAgent,
      success: false,
      errorCode: ERROR_CODES.INVALID_CREDENTIALS,
      metadata: { attemptCount: attempts.count }
    });

    return false; // Account not locked yet
  }

  /**
   * Clear failed attempts for successful login
   */
  static clearFailedAttempts(email: string): void {
    LOGIN_ATTEMPTS.delete(email);
  }

  /**
   * Get lockout information for an email
   */
  static getLockoutInfo(email: string): { locked: boolean; attemptsRemaining: number; lockedUntil?: Date } {
    const attempts = LOGIN_ATTEMPTS.get(email);
    
    if (!attempts) {
      return { locked: false, attemptsRemaining: MAX_LOGIN_ATTEMPTS };
    }

    const locked = this.isAccountLocked(email);
    const attemptsRemaining = Math.max(0, MAX_LOGIN_ATTEMPTS - attempts.count);

    return {
      locked,
      attemptsRemaining,
      lockedUntil: attempts.lockedUntil
    };
  }

  /**
   * Log successful authentication
   */
  static logSuccessfulAuth(
    userId: string,
    email: string,
    method: 'email' | 'google' | 'phone' | 'replit',
    ip?: string,
    userAgent?: string
  ): void {
    AuthLogger.logAuthEvent({
      userId,
      email,
      method,
      action: 'login',
      ip,
      userAgent,
      success: true
    });

    // Clear any failed attempts
    if (method === 'email') {
      this.clearFailedAttempts(email);
    }
  }

  /**
   * Log failed authentication
   */
  static logFailedAuth(
    email: string,
    method: 'email' | 'google' | 'phone' | 'replit',
    errorCode: string,
    ip?: string,
    userAgent?: string
  ): void {
    AuthLogger.logAuthEvent({
      email,
      method,
      action: 'failed_attempt',
      ip,
      userAgent,
      success: false,
      errorCode
    });
  }

  /**
   * Log logout event
   */
  static logLogout(userId: string, email: string, method: string): void {
    AuthLogger.logAuthEvent({
      userId,
      email,
      method: method as any,
      action: 'logout',
      success: true
    });
  }

  /**
   * Get authentication metrics for monitoring
   */
  static async getAuthMetrics(hours: number = 24): Promise<AuthMetrics> {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      // Get recent API usage for auth endpoints
      const authUsage = await storage.getApiUsageSince(since, ['login', 'register', 'google', 'phone']);
      
      const totalLogins = authUsage.length;
      const successfulLogins = authUsage.filter(u => u.success).length;
      const failedLogins = totalLogins - successfulLogins;
      const lockedAccounts = Array.from(LOGIN_ATTEMPTS.values()).filter(a => 
        a.lockedUntil && new Date() < a.lockedUntil
      ).length;

      const successRate = totalLogins > 0 ? (successfulLogins / totalLogins) * 100 : 100;

      const recentAttempts = authUsage.slice(-50).map(usage => ({
        timestamp: usage.createdAt!.toISOString(),
        method: usage.endpoint,
        success: usage.success,
        errorCode: usage.errorMessage || undefined
      }));

      return {
        totalLogins,
        successfulLogins,
        failedLogins,
        lockedAccounts,
        successRate,
        recentAttempts
      };
    } catch (error) {
      console.error('Failed to get auth metrics:', error);
      return {
        totalLogins: 0,
        successfulLogins: 0,
        failedLogins: 0,
        lockedAccounts: 0,
        successRate: 100,
        recentAttempts: []
      };
    }
  }

  /**
   * Check for suspicious authentication patterns
   */
  static detectSuspiciousActivity(): void {
    const now = new Date();
    const suspiciousAccounts: string[] = [];

    for (const [email, attempts] of LOGIN_ATTEMPTS.entries()) {
      // Flag accounts with recent high failure rates
      if (attempts.count >= 3 && 
          now.getTime() - attempts.lastAttempt.getTime() < ATTEMPT_WINDOW) {
        suspiciousAccounts.push(email);
      }
    }

    if (suspiciousAccounts.length > 0) {
      AuthLogger.logSecurityEvent('suspicious_login_pattern', {
        accounts: suspiciousAccounts,
        timestamp: now.toISOString()
      });
    }
  }
}

// Run periodic security checks
setInterval(() => {
  AuthMonitor.detectSuspiciousActivity();
}, 5 * 60 * 1000); // Every 5 minutes