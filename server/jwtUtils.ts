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

// JWT utilities class
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
}