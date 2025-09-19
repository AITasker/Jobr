import type { Request, Response } from "express";

// Initialize SendGrid
let sendgrid: any = null;

// Initialize SendGrid if API key is available
if (process.env.SENDGRID_API_KEY) {
  try {
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    sendgrid = sgMail;
    console.log('SendGrid initialized successfully');
  } catch (error) {
    console.warn('Failed to initialize SendGrid:', error);
  }
} else {
  console.warn('SendGrid not initialized: SENDGRID_API_KEY environment variable not found');
}

export interface EmailData {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
}

export class SendGridService {
  private static readonly DEFAULT_FROM = 'noreply@careercopilot.app';

  // Test mode detection
  static isTestMode(): boolean {
    return process.env.NODE_ENV === 'test' || process.env.TEST_USE_MOCKS === 'true';
  }

  static isAvailable(): boolean {
    if (this.isTestMode()) {
      return true; // Always available in test mode with mocks
    }
    return !!sendgrid;
  }

  /**
   * Send email with fallback to console logging
   */
  static async sendEmail(emailData: EmailData): Promise<{ success: boolean; message: string; code?: string }> {
    try {
      // Use mock service in test mode
      if (this.isTestMode()) {
        console.log('📧 SendGrid Service: Using mock service for email in test mode');
        console.log(`Mock Email - To: ${emailData.to}, Subject: ${emailData.subject}`);
        return {
          success: true,
          message: 'Email sent via mock service',
          code: 'MOCK_SUCCESS'
        };
      }

      if (!SendGridService.isAvailable()) {
        // Fallback: Log to console in development/when SendGrid not configured
        console.log('📧 Email Service Fallback (SendGrid not configured):');
        console.log(`To: ${emailData.to}`);
        console.log(`Subject: ${emailData.subject}`);
        console.log(`Text: ${emailData.text || 'No text content'}`);
        console.log(`HTML: ${emailData.html ? 'HTML content provided' : 'No HTML content'}`);
        console.log('---');

        return {
          success: true,
          message: 'Email logged to console (SendGrid not configured)',
          code: 'FALLBACK_CONSOLE'
        };
      }

      const msg = {
        to: emailData.to,
        from: emailData.from || SendGridService.DEFAULT_FROM,
        subject: emailData.subject,
        text: emailData.text,
        html: emailData.html,
      };

      await sendgrid.send(msg);

      return {
        success: true,
        message: 'Email sent successfully via SendGrid'
      };
    } catch (error: any) {
      console.error('SendGrid email error:', error);
      
      // Fallback: Log to console when SendGrid fails
      console.log('📧 Email Service Fallback (SendGrid failed):');
      console.log(`To: ${emailData.to}`);
      console.log(`Subject: ${emailData.subject}`);
      console.log(`Error: ${error.message || error}`);
      console.log('---');

      return {
        success: false,
        message: `Email failed: ${error.message || 'Unknown error'}`,
        code: 'SENDGRID_ERROR'
      };
    }
  }

  /**
   * Send welcome email
   */
  static async sendWelcomeEmail(userEmail: string, userName: string): Promise<{ success: boolean; message: string }> {
    return SendGridService.sendEmail({
      to: userEmail,
      subject: 'Welcome to Career Co-Pilot!',
      text: `Hi ${userName},\n\nWelcome to Career Co-Pilot! We're excited to help you find your next great opportunity.\n\nGet started by uploading your CV and exploring job matches.\n\nBest regards,\nThe Career Co-Pilot Team`,
      html: `
        <h2>Welcome to Career Co-Pilot!</h2>
        <p>Hi ${userName},</p>
        <p>Welcome to Career Co-Pilot! We're excited to help you find your next great opportunity.</p>
        <p>Get started by uploading your CV and exploring job matches.</p>
        <p>Best regards,<br>The Career Co-Pilot Team</p>
      `
    });
  }

  /**
   * Send password reset email
   */
  static async sendPasswordResetEmail(userEmail: string, resetLink: string): Promise<{ success: boolean; message: string }> {
    return SendGridService.sendEmail({
      to: userEmail,
      subject: 'Reset Your Password - Career Co-Pilot',
      text: `You requested a password reset. Click the following link to reset your password: ${resetLink}\n\nIf you didn't request this, please ignore this email.\n\nThis link expires in 1 hour.`,
      html: `
        <h2>Reset Your Password</h2>
        <p>You requested a password reset for your Career Co-Pilot account.</p>
        <p><a href="${resetLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
        <p>If you didn't request this, please ignore this email.</p>
        <p><small>This link expires in 1 hour.</small></p>
      `
    });
  }

  /**
   * Send email verification
   */
  static async sendEmailVerification(userEmail: string, verificationLink: string): Promise<{ success: boolean; message: string }> {
    return SendGridService.sendEmail({
      to: userEmail,
      subject: 'Verify Your Email - Career Co-Pilot',
      text: `Please verify your email address by clicking the following link: ${verificationLink}\n\nThis link expires in 24 hours.`,
      html: `
        <h2>Verify Your Email</h2>
        <p>Please verify your email address for your Career Co-Pilot account.</p>
        <p><a href="${verificationLink}" style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a></p>
        <p><small>This link expires in 24 hours.</small></p>
      `
    });
  }

  /**
   * Send application confirmation email
   */
  static async sendApplicationConfirmation(
    userEmail: string, 
    userName: string, 
    jobTitle: string, 
    company: string
  ): Promise<{ success: boolean; message: string }> {
    return SendGridService.sendEmail({
      to: userEmail,
      subject: `Application Confirmed: ${jobTitle} at ${company}`,
      text: `Hi ${userName},\n\nYour application for ${jobTitle} at ${company} has been submitted successfully.\n\nWe'll keep you updated on your application status.\n\nBest regards,\nThe Career Co-Pilot Team`,
      html: `
        <h2>Application Confirmed</h2>
        <p>Hi ${userName},</p>
        <p>Your application for <strong>${jobTitle}</strong> at <strong>${company}</strong> has been submitted successfully.</p>
        <p>We'll keep you updated on your application status.</p>
        <p>Best regards,<br>The Career Co-Pilot Team</p>
      `
    });
  }
}