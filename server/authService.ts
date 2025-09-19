import bcrypt from 'bcryptjs';
import { JwtUtils } from './jwtUtils';
import { storage } from './storage';
import { AuthMonitor } from './authMonitor';
import { AUTH_ERRORS, ERROR_CODES, AuthLogger } from './utils/errorHandler';
import type { RegisterData, LoginData, User, AuthAccount, InsertOtpCode, OtpCode } from '@shared/schema';

// Authentication result types
export interface AuthResult {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
  code?: string;
}

export interface RegistrationResult extends AuthResult {
  emailVerificationRequired?: boolean;
}

// Authentication service class
export class AuthService {
  private static readonly SALT_ROUNDS = 12;
  private static readonly MAX_LOGIN_ATTEMPTS = 5;
  private static readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

  /**
   * Hash a password using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * Verify a password against its hash
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Register a new user with email/password
   */
  static async register(data: RegisterData, ip?: string, userAgent?: string): Promise<RegistrationResult> {
    try {
      // Check if user already exists
      const existingAccount = await storage.getAuthAccountByEmail(data.email, 'email');
      if (existingAccount) {
        AuthLogger.logAuthEvent({
          email: data.email,
          method: 'email',
          action: 'register',
          ip,
          userAgent,
          success: false,
          errorCode: ERROR_CODES.EMAIL_EXISTS
        });
        
        return {
          success: false,
          error: 'An account with this email already exists',
          code: 'EMAIL_EXISTS'
        };
      }

      // Hash the password
      const passwordHash = await this.hashPassword(data.password);

      // Create user first
      const user = await storage.createUser({
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        plan: 'Explorer',
        creditsRemaining: 3,
        apiCallsToday: 0,
      });

      // Create auth account
      await storage.createAuthAccount({
        userId: user.id,
        provider: 'email',
        email: data.email,
        passwordHash,
        verified: false, // TODO: Implement email verification
      });

      // Generate JWT token
      const token = JwtUtils.signToken({
        userId: user.id,
        email: user.email!
      });

      // Log successful registration
      AuthLogger.logAuthEvent({
        userId: user.id,
        email: user.email!,
        method: 'email',
        action: 'register',
        ip,
        userAgent,
        success: true
      });

      return {
        success: true,
        user,
        token,
        emailVerificationRequired: true
      };
    } catch (error) {
      console.error('Registration error:', error);
      AuthLogger.logAuthEvent({
        email: data.email,
        method: 'email',
        action: 'register',
        ip,
        userAgent,
        success: false,
        errorCode: ERROR_CODES.REGISTRATION_FAILED,
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
      
      return {
        success: false,
        error: 'Registration failed. Please try again.',
        code: 'REGISTRATION_FAILED'
      };
    }
  }

  /**
   * Login user with email/password with enhanced security
   */
  static async login(data: LoginData, ip?: string, userAgent?: string): Promise<AuthResult> {
    try {
      // Check for account lockout first
      if (AuthMonitor.isAccountLocked(data.email)) {
        const lockoutInfo = AuthMonitor.getLockoutInfo(data.email);
        AuthLogger.logAuthEvent({
          email: data.email,
          method: 'email',
          action: 'failed_attempt',
          ip,
          userAgent,
          success: false,
          errorCode: ERROR_CODES.ACCOUNT_LOCKED,
          metadata: { reason: 'account_locked', lockedUntil: lockoutInfo.lockedUntil }
        });
        
        return {
          success: false,
          error: 'Account temporarily locked due to too many failed login attempts. Please try again later.',
          code: 'ACCOUNT_LOCKED'
        };
      }

      // Get auth account by email
      const authAccount = await storage.getAuthAccountByEmail(data.email, 'email');
      if (!authAccount || !authAccount.passwordHash) {
        // Record failed attempt for invalid email
        AuthMonitor.recordFailedAttempt(data.email, ip, userAgent);
        return {
          success: false,
          error: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        };
      }
      
      // Verify password
      const isValidPassword = await this.verifyPassword(data.password, authAccount.passwordHash);
      if (!isValidPassword) {
        // Record failed attempt for invalid password
        const isLocked = AuthMonitor.recordFailedAttempt(data.email, ip, userAgent);
        
        return {
          success: false,
          error: isLocked ? 
            'Account temporarily locked due to too many failed login attempts. Please try again later.' :
            'Invalid email or password',
          code: isLocked ? 'ACCOUNT_LOCKED' : 'INVALID_CREDENTIALS'
        };
      }

      // Get user details
      const user = await storage.getUser(authAccount.userId);
      if (!user) {
        AuthMonitor.recordFailedAttempt(data.email, ip, userAgent);
        return {
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        };
      }

      // Generate JWT token
      const token = JwtUtils.signToken({
        userId: user.id,
        email: user.email!
      });

      // Log successful authentication and clear failed attempts
      AuthMonitor.logSuccessfulAuth(user.id, user.email!, 'email', ip, userAgent);

      return {
        success: true,
        user,
        token
      };
    } catch (error) {
      console.error('Login error:', error);
      AuthLogger.logAuthEvent({
        email: data.email,
        method: 'email',
        action: 'failed_attempt',
        ip,
        userAgent,
        success: false,
        errorCode: ERROR_CODES.LOGIN_FAILED,
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
      
      return {
        success: false,
        error: 'Login failed. Please try again.',
        code: 'LOGIN_FAILED'
      };
    }
  }

  /**
   * Get user by JWT token
   */
  static async getUserFromToken(token: string): Promise<User | null> {
    try {
      const payload = JwtUtils.verifyToken(token);
      if (!payload) {
        return null;
      }

      const user = await storage.getUser(payload.userId);
      return user || null;
    } catch (error) {
      console.error('Token verification error:', error);
      return null;
    }
  }

  /**
   * Refresh user session and validate account status
   */
  static async refreshUserSession(userId: string): Promise<User | null> {
    try {
      const user = await storage.getUser(userId);
      if (!user) {
        return null;
      }

      // Additional validation - check if account should be suspended
      if (user.email && AuthMonitor.isAccountLocked(user.email)) {
        AuthLogger.logAuthEvent({
          userId: user.id,
          email: user.email,
          method: 'email',
          action: 'refresh',
          success: false,
          errorCode: ERROR_CODES.ACCOUNT_LOCKED
        });
        return null;
      }
      
      return user;
    } catch (error) {
      console.error('Session refresh error:', error);
      return null;
    }
  }

  /**
   * Validate email format and availability
   */
  static async validateEmail(email: string): Promise<{ valid: boolean; available: boolean; error?: string }> {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        valid: false,
        available: false,
        error: 'Invalid email format'
      };
    }

    try {
      // Check availability
      const existingAccount = await storage.getAuthAccountByEmail(email, 'email');
      return {
        valid: true,
        available: !existingAccount,
        error: existingAccount ? 'Email already in use' : undefined
      };
    } catch (error) {
      console.error('Email validation error:', error);
      return {
        valid: true,
        available: false,
        error: 'Unable to validate email availability'
      };
    }
  }

  /**
   * Generate a secure random password (for password reset, etc.)
   */
  static generateSecurePassword(length: number = 16): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  /**
   * Handle Google OAuth authentication
   */
  static async handleGoogleAuth(profile: any, accessToken: string, ip?: string, userAgent?: string): Promise<AuthResult> {
    try {
      const email = profile.emails?.[0]?.value;
      const firstName = profile.name?.givenName || profile.displayName;
      const lastName = profile.name?.familyName;
      const profileImageUrl = profile.photos?.[0]?.value;
      
      if (!email) {
        return {
          success: false,
          error: 'No email address found in Google profile',
          code: 'NO_EMAIL'
        };
      }

      // Check if Google account already exists
      let authAccount = await storage.getAuthAccountByEmail(email, 'google');
      let user: User;

      if (authAccount) {
        // Existing Google account - get user
        const existingUser = await storage.getUser(authAccount.userId);
        if (!existingUser) {
          return {
            success: false,
            error: 'Associated user not found',
            code: 'USER_NOT_FOUND'
          };
        }
        user = existingUser;
      } else {
        // Check if user exists with this email but different provider
        const existingEmailAccount = await storage.getAuthAccountByEmail(email, 'email');
        
        if (existingEmailAccount) {
          // Link Google account to existing user
          user = (await storage.getUser(existingEmailAccount.userId))!;
          authAccount = await storage.createAuthAccount({
            userId: user.id,
            provider: 'google',
            providerUserId: profile.id,
            email,
            verified: true,
          });
        } else {
          // Create new user and Google account
          user = await storage.createUser({
            email,
            firstName,
            lastName,
            profileImageUrl,
            plan: 'Explorer',
            creditsRemaining: 3,
            apiCallsToday: 0,
          });

          authAccount = await storage.createAuthAccount({
            userId: user.id,
            provider: 'google',
            providerUserId: profile.id,
            email,
            verified: true,
          });
        }
      }

      // Generate JWT token
      const token = JwtUtils.signToken({
        userId: user.id,
        email: user.email!
      });

      // Log successful Google authentication
      AuthLogger.logAuthEvent({
        userId: user.id,
        email: user.email!,
        method: 'google',
        action: authAccount ? 'login' : 'register',
        ip,
        userAgent,
        success: true
      });

      return {
        success: true,
        user,
        token
      };
    } catch (error) {
      console.error('Google auth error:', error);
      const email = profile?.emails?.[0]?.value;
      AuthLogger.logAuthEvent({
        email: email || 'unknown',
        method: 'google',
        action: 'login',
        ip,
        userAgent,
        success: false,
        errorCode: 'GOOGLE_AUTH_FAILED',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
      
      return {
        success: false,
        error: 'Google authentication failed',
        code: 'GOOGLE_AUTH_FAILED'
      };
    }
  }

  /**
   * Generate and send OTP for phone authentication
   */
  static async requestPhoneOTP(phoneNumber: string): Promise<{ success: boolean; message: string; code?: string }> {
    try {
      // Clean up expired OTP codes first
      await storage.cleanupExpiredOtpCodes();

      // Validate phone number format (basic validation)
      const phoneRegex = /^\+?[1-9]\d{1,14}$/;
      if (!phoneRegex.test(phoneNumber.replace(/[\s\-\(\)]/g, ''))) {
        return {
          success: false,
          message: 'Invalid phone number format',
          code: 'INVALID_PHONE'
        };
      }

      const normalizedPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');
      
      // Check for existing unexpired OTP
      const existingOtp = await storage.getOtpCode(normalizedPhone, 'phone_login');
      if (existingOtp && existingOtp.expiresAt > new Date() && !existingOtp.used) {
        return {
          success: false,
          message: 'An OTP was already sent. Please wait before requesting another.',
          code: 'OTP_ALREADY_SENT'
        };
      }

      // Generate 6-digit OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const otpHash = await this.hashPassword(otpCode);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      // Store hashed OTP
      await storage.createOtpCode({
        target: phoneNumber,
        sentTo: normalizedPhone,
        codeHash: otpHash,
        purpose: 'phone_login',
        expiresAt,
        attempts: 0,
        used: false
      });

      // TODO: Send SMS via provider (Twilio, etc.)
      // For now, use fallback method - log to console for development
      console.log(`📱 Phone OTP for ${phoneNumber}: ${otpCode} (expires in 5 minutes)`);

      return {
        success: true,
        message: 'OTP sent successfully. Check your phone for the code.',
        code: process.env.NODE_ENV === 'development' ? otpCode : undefined // Only in development
      };
    } catch (error) {
      console.error('Phone OTP request error:', error);
      return {
        success: false,
        message: 'Failed to send OTP. Please try again.',
        code: 'OTP_SEND_FAILED'
      };
    }
  }

  /**
   * Verify phone OTP and authenticate user
   */
  static async verifyPhoneOTP(phoneNumber: string, otpCode: string, firstName?: string, lastName?: string): Promise<AuthResult> {
    try {
      const normalizedPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');
      
      // Get OTP record
      const otpRecord = await storage.getOtpCode(normalizedPhone, 'phone_login');
      if (!otpRecord) {
        return {
          success: false,
          error: 'No OTP found for this phone number',
          code: 'OTP_NOT_FOUND'
        };
      }

      // Check if OTP is expired or used
      if (otpRecord.expiresAt <= new Date()) {
        return {
          success: false,
          error: 'OTP has expired. Please request a new one.',
          code: 'OTP_EXPIRED'
        };
      }

      if (otpRecord.used) {
        return {
          success: false,
          error: 'OTP has already been used',
          code: 'OTP_USED'
        };
      }

      // Check attempts limit
      if (otpRecord.attempts >= 3) {
        return {
          success: false,
          error: 'Too many failed attempts. Please request a new OTP.',
          code: 'TOO_MANY_ATTEMPTS'
        };
      }

      // Verify OTP code
      const isValidOtp = await this.verifyPassword(otpCode, otpRecord.codeHash);
      if (!isValidOtp) {
        // Increment attempts
        await storage.updateOtpCode(otpRecord.id, {
          attempts: otpRecord.attempts + 1
        });
        
        return {
          success: false,
          error: 'Invalid OTP code',
          code: 'INVALID_OTP'
        };
      }

      // Mark OTP as used
      await storage.updateOtpCode(otpRecord.id, {
        used: true
      });

      // Check if user exists with this phone number
      let user: User;
      const existingAccount = await storage.getAuthAccountByEmail(normalizedPhone, 'phone');
      
      if (existingAccount) {
        // Existing user
        const existingUser = await storage.getUser(existingAccount.userId);
        if (!existingUser) {
          return {
            success: false,
            error: 'Associated user not found',
            code: 'USER_NOT_FOUND'
          };
        }
        user = existingUser;
      } else {
        // Create new user
        if (!firstName) {
          return {
            success: false,
            error: 'First name is required for new phone registrations',
            code: 'FIRST_NAME_REQUIRED'
          };
        }
        
        user = await storage.createUser({
          email: null,
          firstName,
          lastName,
          plan: 'Explorer',
          creditsRemaining: 3,
          apiCallsToday: 0,
        });

        // Create phone auth account
        await storage.createAuthAccount({
          userId: user.id,
          provider: 'phone',
          phone: normalizedPhone,
          verified: true,
        });
      }

      // Generate JWT token
      const token = JwtUtils.signToken({
        userId: user.id,
        email: user.email || normalizedPhone // Use phone as fallback identifier
      });

      return {
        success: true,
        user,
        token
      };
    } catch (error) {
      console.error('Phone OTP verification error:', error);
      return {
        success: false,
        error: 'OTP verification failed',
        code: 'OTP_VERIFY_FAILED'
      };
    }
  }
}