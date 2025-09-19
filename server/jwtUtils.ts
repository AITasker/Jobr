import jwt from 'jsonwebtoken';
import type { Response, Request } from 'express';

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
const JWT_EXPIRES_IN = '7d'; // 7 days
const COOKIE_NAME = 'auth-token';

// JWT payload interface
export interface JwtPayload {
  userId: string;
  email: string;
  type: 'access'; // Future: could add 'refresh' for refresh tokens
  iat?: number;
  exp?: number;
}

// JWT utilities class with enhanced session management
export class JwtUtils {
  /**
   * Sign a JWT token with user payload
   */
  static signToken(payload: Omit<JwtPayload, 'type' | 'iat' | 'exp'>): string {
    const tokenPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
      ...payload,
      type: 'access'
    };

    return jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'career-copilot',
      audience: 'career-copilot-users'
    });
  }

  /**
   * Verify and decode a JWT token
   */
  static verifyToken(token: string): JwtPayload | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET, {
        issuer: 'career-copilot',
        audience: 'career-copilot-users'
      }) as JwtPayload;
      
      return decoded;
    } catch (error) {
      // Token is invalid, expired, or malformed
      return null;
    }
  }

  /**
   * Set JWT token as httpOnly secure cookie
   */
  static setTokenCookie(res: Response, token: string): void {
    const isProduction = process.env.NODE_ENV === 'production';
    
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction, // HTTPS only in production
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
      path: '/'
    });
  }

  /**
   * Clear JWT token cookie
   */
  static clearTokenCookie(res: Response): void {
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/'
    });
  }

  /**
   * Extract JWT token from request cookies
   */
  static getTokenFromRequest(req: Request): string | null {
    return req.cookies?.[COOKIE_NAME] || null;
  }

  /**
   * Extract and verify JWT payload from request
   */
  static getPayloadFromRequest(req: Request): JwtPayload | null {
    const token = this.getTokenFromRequest(req);
    if (!token) {
      return null;
    }
    
    return this.verifyToken(token);
  }

  /**
   * Check if a token is expired (for manual checks)
   */
  static isTokenExpired(payload: JwtPayload): boolean {
    if (!payload.exp) {
      return true;
    }
    
    const now = Math.floor(Date.now() / 1000);
    return now >= payload.exp;
  }

  /**
   * Get time until token expires (in seconds)
   */
  static getTimeUntilExpiry(payload: JwtPayload): number {
    if (!payload.exp) {
      return 0;
    }
    
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, payload.exp - now);
  }

  /**
   * Check if token needs refresh (expires within the next hour)
   */
  static needsRefresh(payload: JwtPayload): boolean {
    const timeUntilExpiry = this.getTimeUntilExpiry(payload);
    return timeUntilExpiry > 0 && timeUntilExpiry < 3600; // Refresh if expires within 1 hour
  }

  /**
   * Generate a new token with fresh expiry time
   */
  static refreshToken(payload: JwtPayload): string {
    if (this.isTokenExpired(payload)) {
      throw new Error('Cannot refresh expired token');
    }

    return this.signToken({
      userId: payload.userId,
      email: payload.email
    });
  }

  /**
   * Validate token format and structure
   */
  static validateTokenFormat(token: string): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }

    // JWT tokens have 3 parts separated by dots
    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }

    // Each part should be base64 encoded
    try {
      parts.forEach(part => {
        Buffer.from(part, 'base64');
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Extract token payload without verification (for debugging)
   */
  static extractPayloadUnsafe(token: string): any {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }
      
      const payload = Buffer.from(parts[1], 'base64').toString('utf8');
      return JSON.parse(payload);
    } catch {
      return null;
    }
  }
}