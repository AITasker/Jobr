import type { Request, Response } from "express";
import { storage } from "./storage";
import { SendGridService } from "./sendgridService";
import type { 
  Application, 
  InsertEmailEvent, 
  InsertApplicationHistory,
  InsertApplicationNotification 
} from "@shared/schema";

// Enhanced email monitoring service with SendGrid integration
export class EmailMonitoringService {
  private static readonly EMAIL_TRACKING_PIXEL = '<img src="{{trackingPixel}}" width="1" height="1" alt="" style="display:none;">';
  private static readonly TRACKING_DOMAIN = process.env.TRACKING_DOMAIN || 'track.careercopilot.app';

  /**
   * Send application email with comprehensive tracking
   */
  static async sendApplicationEmail(
    application: Application,
    recipientEmail: string,
    subject: string,
    htmlContent: string,
    textContent?: string
  ): Promise<{ success: boolean; message: string; messageId?: string }> {
    try {
      // Add tracking pixel to HTML content
      const trackedHtmlContent = await this.addEmailTracking(
        htmlContent,
        application.id,
        application.userId
      );

      // Send email via SendGrid
      const result = await SendGridService.sendEmail({
        to: recipientEmail,
        subject,
        html: trackedHtmlContent,
        text: textContent,
      });

      if (result.success) {
        // Record email event
        await this.recordEmailEvent({
          applicationId: application.id,
          userId: application.userId,
          eventType: 'sent',
          emailType: 'application_sent',
          recipientEmail,
          subject,
          metadata: {
            htmlContent: trackedHtmlContent,
            textContent,
            sendGridResponse: result
          }
        });

        // Update application with email sent timestamp
        await storage.updateApplication(application.id, {
          emailSentAt: new Date(),
          lastEmailInteractionAt: new Date()
        });

        // Record status change in history
        await this.recordStatusChange(application, 'applied', 'email_sent', {
          emailSent: true,
          recipientEmail,
          subject
        });

        return {
          success: true,
          message: 'Application email sent with tracking',
          messageId: result.code || 'sent'
        };
      }

      return result;
    } catch (error: any) {
      console.error('EmailMonitoringService: Failed to send application email:', error);
      return {
        success: false,
        message: error.message || 'Failed to send application email'
      };
    }
  }

  /**
   * Send follow-up email with tracking
   */
  static async sendFollowUpEmail(
    application: Application,
    recipientEmail: string,
    subject: string,
    htmlContent: string,
    textContent?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const trackedHtmlContent = await this.addEmailTracking(
        htmlContent,
        application.id,
        application.userId
      );

      const result = await SendGridService.sendEmail({
        to: recipientEmail,
        subject,
        html: trackedHtmlContent,
        text: textContent,
      });

      if (result.success) {
        await this.recordEmailEvent({
          applicationId: application.id,
          userId: application.userId,
          eventType: 'sent',
          emailType: 'follow_up',
          recipientEmail,
          subject,
          metadata: {
            htmlContent: trackedHtmlContent,
            textContent
          }
        });

        // Update follow-up status
        await storage.updateApplication(application.id, {
          lastEmailInteractionAt: new Date(),
          followUpReminderSent: true
        });

        return {
          success: true,
          message: 'Follow-up email sent with tracking'
        };
      }

      return result;
    } catch (error: any) {
      console.error('EmailMonitoringService: Failed to send follow-up email:', error);
      return {
        success: false,
        message: error.message || 'Failed to send follow-up email'
      };
    }
  }

  /**
   * Handle SendGrid webhook events for email tracking
   */
  static async handleSendGridWebhook(events: any[]): Promise<void> {
    for (const event of events) {
      try {
        await this.processEmailEvent(event);
      } catch (error) {
        console.error('EmailMonitoringService: Failed to process webhook event:', error);
      }
    }
  }

  /**
   * Process individual email event from webhook
   */
  private static async processEmailEvent(event: any): Promise<void> {
    const { event: eventType, email, timestamp, unique_arg_application_id, unique_arg_user_id } = event;

    if (!unique_arg_application_id || !unique_arg_user_id) {
      console.warn('EmailMonitoringService: Missing application tracking data in webhook event');
      return;
    }

    // Record the email event
    await this.recordEmailEvent({
      applicationId: unique_arg_application_id,
      userId: unique_arg_user_id,
      eventType: eventType,
      emailType: this.determineEmailType(event),
      recipientEmail: email,
      metadata: event,
      timestamp: new Date(timestamp * 1000)
    });

    // Update application based on event type
    await this.updateApplicationFromEmailEvent(
      unique_arg_application_id,
      eventType,
      event
    );

    // Check for automatic status updates
    await this.checkForStatusUpdates(unique_arg_application_id, eventType, event);
  }

  /**
   * Update application status based on email event
   */
  private static async updateApplicationFromEmailEvent(
    applicationId: string,
    eventType: string,
    eventData: any
  ): Promise<void> {
    const updates: Partial<Application> = {
      lastEmailInteractionAt: new Date()
    };

    switch (eventType) {
      case 'open':
        updates.emailOpened = true;
        updates.emailOpenedAt = new Date(eventData.timestamp * 1000);
        // Increment employer interaction score
        const app = await storage.getApplicationWithJob(applicationId);
        if (app) {
          updates.employerInteractionScore = (app.employerInteractionScore || 0) + 10;
          updates.employerProfileViews = (app.employerProfileViews || 0) + 1;
        }
        break;

      case 'click':
        // High engagement - significant employer interest
        updates.employerInteractionScore = (updates.employerInteractionScore || 0) + 25;
        break;

      case 'bounce':
      case 'dropped':
        // Email failed to deliver
        await this.createNotification(applicationId, eventData.unique_arg_user_id, {
          type: 'email_delivery_failed',
          title: 'Application Email Failed to Deliver',
          message: `Your application email bounced or was dropped. Please verify the employer email address.`,
          metadata: { eventData }
        });
        break;

      case 'spamreport':
        // Mark as potential issue
        await this.createNotification(applicationId, eventData.unique_arg_user_id, {
          type: 'email_marked_spam',
          title: 'Application Email Marked as Spam',
          message: `Your application email was marked as spam. Consider revising your email content.`,
          metadata: { eventData }
        });
        break;
    }

    if (Object.keys(updates).length > 0) {
      await storage.updateApplication(applicationId, updates);
    }
  }

  /**
   * Check for automatic status updates based on email patterns
   */
  private static async checkForStatusUpdates(
    applicationId: string,
    eventType: string,
    eventData: any
  ): Promise<void> {
    // If email was opened multiple times, likely under review
    if (eventType === 'open') {
      const recentOpens = await storage.getEmailEventsByApplication(
        applicationId, 
        'open', 
        7 // last 7 days
      );
      
      if (recentOpens && recentOpens.length >= 3) {
        const application = await storage.getApplicationWithJob(applicationId);
        if (application && application.status === 'applied') {
          await storage.updateApplication(applicationId, {
            status: 'viewed',
            viewedByEmployerAt: new Date(),
            lastStatusChangeAt: new Date()
          });

          await this.recordStatusChange(
            application,
            'applied',
            'viewed',
            'email_engagement',
            { multipleOpens: recentOpens.length }
          );
        }
      }
    }
  }

  /**
   * Parse incoming email responses for automatic status updates
   */
  static async parseEmailResponse(
    fromEmail: string,
    subject: string,
    content: string,
    inReplyTo?: string
  ): Promise<{ applicationId?: string; detectedStatus?: string; confidence: number }> {
    try {
      // Find application by matching email domain with job company
      const applications = await this.findApplicationsByEmployerEmail(fromEmail);
      
      if (applications.length === 0) {
        return { confidence: 0 };
      }

      // Analyze content for status indicators
      const statusAnalysis = this.analyzeEmailContentForStatus(subject, content);
      
      const mostLikelyApplication = applications[0]; // Simple heuristic - could be improved
      
      if (statusAnalysis.status && statusAnalysis.confidence > 0.7) {
        // Update application status
        await storage.updateApplication(mostLikelyApplication.id, {
          status: statusAnalysis.status as any,
          emailRepliedAt: new Date(),
          lastStatusChangeAt: new Date(),
          lastEmailInteractionAt: new Date()
        });

        // Record the response
        await this.recordEmailEvent({
          applicationId: mostLikelyApplication.id,
          userId: mostLikelyApplication.userId,
          eventType: 'replied',
          emailType: 'employer_response',
          recipientEmail: fromEmail,
          subject,
          metadata: {
            content,
            detectedStatus: statusAnalysis.status,
            confidence: statusAnalysis.confidence,
            keywords: statusAnalysis.keywords
          }
        });

        // Create notification for user
        await this.createNotification(
          mostLikelyApplication.id,
          mostLikelyApplication.userId,
          {
            type: 'employer_response',
            title: 'Employer Response Received',
            message: `You received a response for your ${mostLikelyApplication.job.title} application at ${mostLikelyApplication.job.company}`,
            metadata: { 
              fromEmail, 
              subject,
              detectedStatus: statusAnalysis.status,
              confidence: statusAnalysis.confidence
            }
          }
        );

        return {
          applicationId: mostLikelyApplication.id,
          detectedStatus: statusAnalysis.status,
          confidence: statusAnalysis.confidence
        };
      }

      return { applicationId: mostLikelyApplication.id, confidence: statusAnalysis.confidence };
    } catch (error) {
      console.error('EmailMonitoringService: Failed to parse email response:', error);
      return { confidence: 0 };
    }
  }

  /**
   * Get email analytics for applications
   */
  static async getEmailAnalytics(
    userId: string,
    applicationIds?: string[],
    dateRange?: { start: Date; end: Date }
  ): Promise<{
    totalSent: number;
    totalOpened: number;
    totalClicked: number;
    totalReplied: number;
    openRate: number;
    clickRate: number;
    responseRate: number;
    averageTimeToOpen?: number;
    averageTimeToResponse?: number;
    events: any[];
  }> {
    try {
      const events = await storage.getEmailEventsByUser(userId, applicationIds, dateRange);

      const analytics = {
        totalSent: events.filter(e => e.eventType === 'sent').length,
        totalOpened: events.filter(e => e.eventType === 'open').length,
        totalClicked: events.filter(e => e.eventType === 'click').length,
        totalReplied: events.filter(e => e.eventType === 'replied').length,
        openRate: 0,
        clickRate: 0,
        responseRate: 0,
        events
      };

      analytics.openRate = analytics.totalSent > 0 ? (analytics.totalOpened / analytics.totalSent) * 100 : 0;
      analytics.clickRate = analytics.totalSent > 0 ? (analytics.totalClicked / analytics.totalSent) * 100 : 0;
      analytics.responseRate = analytics.totalSent > 0 ? (analytics.totalReplied / analytics.totalSent) * 100 : 0;

      return analytics;
    } catch (error) {
      console.error('EmailMonitoringService: Failed to get email analytics:', error);
      throw error;
    }
  }

  /**
   * Add email tracking pixel and metadata
   */
  private static async addEmailTracking(
    htmlContent: string,
    applicationId: string,
    userId: string
  ): Promise<string> {
    const trackingPixelUrl = `https://${this.TRACKING_DOMAIN}/track/open/${applicationId}?u=${userId}`;
    const trackingPixel = this.EMAIL_TRACKING_PIXEL.replace('{{trackingPixel}}', trackingPixelUrl);
    
    // Add tracking pixel before closing body tag
    return htmlContent.replace('</body>', `${trackingPixel}</body>`);
  }

  /**
   * Record email event in database
   */
  private static async recordEmailEvent(eventData: InsertEmailEvent): Promise<void> {
    await storage.createEmailEvent({
      ...eventData,
      timestamp: eventData.timestamp || new Date()
    });
  }

  /**
   * Record application status change
   */
  private static async recordStatusChange(
    application: Application,
    previousStatus: string,
    newStatus: string,
    reason?: string,
    metadata?: any
  ): Promise<void> {
    await storage.createApplicationHistory({
      applicationId: application.id,
      userId: application.userId,
      previousStatus,
      newStatus,
      changeReason: reason || 'email_tracking',
      metadata,
      notes: `Status changed via email monitoring: ${previousStatus} → ${newStatus}`
    });
  }

  /**
   * Create application notification
   */
  private static async createNotification(
    applicationId: string,
    userId: string,
    notificationData: {
      type: string;
      title: string;
      message: string;
      metadata?: any;
    }
  ): Promise<void> {
    await storage.createApplicationNotification({
      applicationId,
      userId,
      notificationType: notificationData.type,
      title: notificationData.title,
      message: notificationData.message,
      scheduledFor: new Date(),
      metadata: notificationData.metadata
    });
  }

  /**
   * Determine email type from event data
   */
  private static determineEmailType(eventData: any): string {
    // Extract email type from custom args or subject analysis
    if (eventData.unique_arg_email_type) {
      return eventData.unique_arg_email_type;
    }
    
    const subject = eventData.subject?.toLowerCase() || '';
    if (subject.includes('follow') || subject.includes('checking')) {
      return 'follow_up';
    }
    if (subject.includes('interview')) {
      return 'interview_request';
    }
    if (subject.includes('application')) {
      return 'application_sent';
    }
    
    return 'unknown';
  }

  /**
   * Find applications by employer email domain
   */
  private static async findApplicationsByEmployerEmail(email: string): Promise<Application[]> {
    // Extract domain from email
    const domain = email.split('@')[1];
    
    // Find applications where company matches domain (simplified matching)
    return await storage.getApplicationsByEmployerDomain(domain);
  }

  /**
   * Analyze email content for status indicators
   */
  private static analyzeEmailContentForStatus(subject: string, content: string): {
    status?: string;
    confidence: number;
    keywords: string[];
  } {
    const text = `${subject} ${content}`.toLowerCase();
    const keywords: string[] = [];
    
    // Interview indicators (high confidence)
    const interviewPatterns = [
      'interview', 'meeting', 'discuss your application', 'schedule a call',
      'would like to speak', 'phone screening', 'video call', 'in-person meeting'
    ];
    
    // Rejection indicators (high confidence)
    const rejectionPatterns = [
      'unfortunately', 'not selected', 'different direction', 'not moving forward',
      'other candidates', 'not a fit', 'declined', 'rejected', 'thank you for your interest'
    ];
    
    // Positive interest indicators (medium confidence)
    const interestPatterns = [
      'impressed', 'interested', 'next steps', 'further discussion',
      'would like to know more', 'looks good', 'promising'
    ];

    for (const pattern of interviewPatterns) {
      if (text.includes(pattern)) {
        keywords.push(pattern);
      }
    }
    
    for (const pattern of rejectionPatterns) {
      if (text.includes(pattern)) {
        keywords.push(pattern);
      }
    }
    
    for (const pattern of interestPatterns) {
      if (text.includes(pattern)) {
        keywords.push(pattern);
      }
    }

    // Determine status based on keyword matches
    if (keywords.some(k => interviewPatterns.includes(k))) {
      return { status: 'interview_scheduled', confidence: 0.85, keywords };
    }
    
    if (keywords.some(k => rejectionPatterns.includes(k))) {
      return { status: 'rejected', confidence: 0.90, keywords };
    }
    
    if (keywords.some(k => interestPatterns.includes(k))) {
      return { status: 'viewed', confidence: 0.65, keywords };
    }

    return { confidence: 0.1, keywords };
  }
}