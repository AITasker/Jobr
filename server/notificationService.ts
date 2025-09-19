import { storage } from "./storage";
import { SendGridService } from "./sendgridService";
import type { 
  Application, 
  User, 
  ApplicationNotification,
  InsertApplicationNotification,
  UserPreferences
} from "@shared/schema";

export interface NotificationPreferences {
  email: {
    statusChanges: boolean;
    interviews: boolean;
    followUps: boolean;
    reminders: boolean;
  };
  push: {
    statusChanges: boolean;
    interviews: boolean;
    followUps: boolean;
    urgent: boolean;
  };
  timing: {
    quietHours: { start: string; end: string };
    timezone: string;
    frequency: 'immediate' | 'hourly' | 'daily';
  };
}

export interface NotificationPayload {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  channels: ('email' | 'push' | 'in_app')[];
  scheduledFor?: Date;
  expiresAt?: Date;
}

export interface CalendarEvent {
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  attendees?: string[];
  reminders?: { minutes: number }[];
  metadata?: any;
}

/**
 * Comprehensive Notification and Alert System
 * Handles real-time notifications, email alerts, push notifications, and calendar integration
 */
export class NotificationService {
  private static websocketConnections = new Map<string, any>(); // WebSocket connections by userId
  private static notificationQueue = new Map<string, NotificationPayload[]>(); // Queued notifications by userId

  /**
   * Initialize notification preferences for a user
   */
  static async initializeUserPreferences(userId: string): Promise<NotificationPreferences> {
    const defaultPreferences: NotificationPreferences = {
      email: {
        statusChanges: true,
        interviews: true,
        followUps: true,
        reminders: true
      },
      push: {
        statusChanges: true,
        interviews: true,
        followUps: false,
        urgent: true
      },
      timing: {
        quietHours: { start: '22:00', end: '08:00' },
        timezone: 'America/New_York',
        frequency: 'immediate'
      }
    };

    try {
      // Check if user preferences exist
      let userPrefs = await storage.getUserPreferences(userId);
      
      if (!userPrefs) {
        // Create default preferences
        await storage.createUserPreferences({
          userId,
          preferences: defaultPreferences,
          isActive: true
        });
        return defaultPreferences;
      }

      return userPrefs.preferences as NotificationPreferences || defaultPreferences;
    } catch (error) {
      console.error('NotificationService: Failed to initialize user preferences:', error);
      return defaultPreferences;
    }
  }

  /**
   * Update user notification preferences
   */
  static async updateUserPreferences(
    userId: string, 
    preferences: Partial<NotificationPreferences>
  ): Promise<{ success: boolean; message: string }> {
    try {
      const currentPrefs = await this.initializeUserPreferences(userId);
      const updatedPrefs = { ...currentPrefs, ...preferences };

      await storage.updateUserPreferences(userId, {
        preferences: updatedPrefs,
        updatedAt: new Date()
      });

      return {
        success: true,
        message: 'Notification preferences updated successfully'
      };
    } catch (error: any) {
      console.error('NotificationService: Failed to update preferences:', error);
      return {
        success: false,
        message: error.message || 'Failed to update notification preferences'
      };
    }
  }

  /**
   * Send comprehensive notification through multiple channels
   */
  static async sendNotification(
    userId: string,
    notification: Omit<NotificationPayload, 'id'>
  ): Promise<{ success: boolean; channels: string[]; errors: string[] }> {
    const result = {
      success: true,
      channels: [] as string[],
      errors: [] as string[]
    };

    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullNotification: NotificationPayload = {
      id: notificationId,
      ...notification
    };

    try {
      // Get user preferences
      const preferences = await this.initializeUserPreferences(userId);
      
      // Check if notification should be sent based on preferences and quiet hours
      const shouldSend = await this.shouldSendNotification(userId, notification.type, preferences);
      
      if (!shouldSend.send) {
        if (shouldSend.reason === 'quiet_hours') {
          // Queue for later
          await this.queueNotification(userId, fullNotification);
          return {
            success: true,
            channels: ['queued'],
            errors: []
          };
        } else {
          return {
            success: false,
            channels: [],
            errors: [shouldSend.reason || 'Notification blocked by user preferences']
          };
        }
      }

      // Store notification in database
      await storage.createApplicationNotification({
        applicationId: notification.data?.applicationId,
        userId,
        notificationType: notification.type,
        title: notification.title,
        message: notification.message,
        scheduledFor: notification.scheduledFor || new Date(),
        metadata: notification.data
      });

      // Send through requested channels
      for (const channel of notification.channels) {
        try {
          switch (channel) {
            case 'email':
              if (this.shouldSendEmailNotification(notification.type, preferences)) {
                await this.sendEmailNotification(userId, fullNotification);
                result.channels.push('email');
              }
              break;

            case 'push':
              if (this.shouldSendPushNotification(notification.type, preferences)) {
                await this.sendPushNotification(userId, fullNotification);
                result.channels.push('push');
              }
              break;

            case 'in_app':
              await this.sendInAppNotification(userId, fullNotification);
              result.channels.push('in_app');
              break;
          }
        } catch (channelError: any) {
          result.errors.push(`${channel}: ${channelError.message}`);
          result.success = false;
        }
      }

      // Process any queued notifications if this is immediate
      if (preferences.timing.frequency === 'immediate') {
        await this.processQueuedNotifications(userId);
      }

      return result;

    } catch (error: any) {
      console.error('NotificationService: Failed to send notification:', error);
      return {
        success: false,
        channels: [],
        errors: [error.message || 'Failed to send notification']
      };
    }
  }

  /**
   * Send application status change notification
   */
  static async sendStatusChangeNotification(
    application: Application,
    previousStatus: string,
    newStatus: string,
    metadata?: any
  ): Promise<void> {
    const statusMessages = {
      'viewed': {
        title: '👀 Application Viewed!',
        message: `Your application for ${application.job.title} at ${application.job.company} has been viewed by the employer.`,
        priority: 'medium' as const
      },
      'interview_scheduled': {
        title: '📅 Interview Scheduled!',
        message: `Great news! Your interview for ${application.job.title} at ${application.job.company} has been scheduled.`,
        priority: 'high' as const
      },
      'interviewing': {
        title: '💼 Interview in Progress',
        message: `Your interview for ${application.job.title} at ${application.job.company} is in progress. Good luck!`,
        priority: 'high' as const
      },
      'interview_completed': {
        title: '✅ Interview Completed',
        message: `Interview completed for ${application.job.title} at ${application.job.company}. Consider sending a follow-up email.`,
        priority: 'medium' as const
      },
      'offered': {
        title: '🎉 Job Offer Received!',
        message: `Congratulations! You've received a job offer for ${application.job.title} at ${application.job.company}!`,
        priority: 'urgent' as const
      },
      'rejected': {
        title: '📝 Application Update',
        message: `Your application for ${application.job.title} at ${application.job.company} was not selected. Keep applying!`,
        priority: 'low' as const
      },
      'withdrawn': {
        title: '↩️ Application Withdrawn',
        message: `Your application for ${application.job.title} at ${application.job.company} has been withdrawn.`,
        priority: 'low' as const
      }
    };

    const statusInfo = statusMessages[newStatus as keyof typeof statusMessages];
    if (!statusInfo) return;

    await this.sendNotification(application.userId, {
      type: 'status_change',
      title: statusInfo.title,
      message: statusInfo.message,
      priority: statusInfo.priority,
      channels: ['email', 'push', 'in_app'],
      data: {
        applicationId: application.id,
        previousStatus,
        newStatus,
        jobTitle: application.job.title,
        company: application.job.company,
        metadata
      }
    });
  }

  /**
   * Send interview reminder notification
   */
  static async sendInterviewReminder(
    application: Application,
    interviewDate: Date,
    reminderType: 'day_before' | 'hour_before' | 'now'
  ): Promise<void> {
    const reminderMessages = {
      'day_before': {
        title: '📅 Interview Tomorrow',
        message: `Your interview for ${application.job.title} at ${application.job.company} is tomorrow at ${interviewDate.toLocaleTimeString()}.`,
        priority: 'high' as const
      },
      'hour_before': {
        title: '⏰ Interview in 1 Hour',
        message: `Your interview for ${application.job.title} at ${application.job.company} starts in 1 hour. Get ready!`,
        priority: 'urgent' as const
      },
      'now': {
        title: '🚀 Interview Starting Now',
        message: `Your interview for ${application.job.title} at ${application.job.company} is starting now. Good luck!`,
        priority: 'urgent' as const
      }
    };

    const reminder = reminderMessages[reminderType];
    
    await this.sendNotification(application.userId, {
      type: 'interview_reminder',
      title: reminder.title,
      message: reminder.message,
      priority: reminder.priority,
      channels: ['email', 'push', 'in_app'],
      data: {
        applicationId: application.id,
        interviewDate,
        reminderType,
        jobTitle: application.job.title,
        company: application.job.company
      }
    });
  }

  /**
   * Create calendar event for interview
   */
  static async createCalendarEvent(
    userId: string,
    application: Application,
    calendarEvent: CalendarEvent
  ): Promise<{ success: boolean; message: string; eventId?: string }> {
    try {
      // This would integrate with calendar services (Google Calendar, Outlook, etc.)
      // For now, we'll create a notification with calendar data
      
      await this.sendNotification(userId, {
        type: 'calendar_event',
        title: '📅 Interview Added to Calendar',
        message: `Interview for ${application.job.title} at ${application.job.company} has been added to your calendar.`,
        priority: 'medium',
        channels: ['in_app', 'email'],
        data: {
          applicationId: application.id,
          calendarEvent,
          icalData: this.generateICalData(calendarEvent)
        }
      });

      return {
        success: true,
        message: 'Calendar event created successfully',
        eventId: `cal_${Date.now()}`
      };
    } catch (error: any) {
      console.error('NotificationService: Failed to create calendar event:', error);
      return {
        success: false,
        message: error.message || 'Failed to create calendar event'
      };
    }
  }

  /**
   * Send bulk notifications (useful for system-wide announcements)
   */
  static async sendBulkNotification(
    userIds: string[],
    notification: Omit<NotificationPayload, 'id'>
  ): Promise<{ sent: number; failed: number; errors: string[] }> {
    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const userId of userIds) {
      try {
        await this.sendNotification(userId, notification);
        results.sent++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(`${userId}: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Get user notifications with pagination
   */
  static async getUserNotifications(
    userId: string,
    options?: {
      unreadOnly?: boolean;
      limit?: number;
      offset?: number;
      type?: string;
    }
  ): Promise<{
    notifications: ApplicationNotification[];
    total: number;
    unreadCount: number;
  }> {
    try {
      const notifications = await storage.getApplicationNotificationsByUserId(
        userId, 
        options?.unreadOnly
      );

      // Simple filtering and pagination (would be better done in database)
      let filteredNotifications = notifications;
      
      if (options?.type) {
        filteredNotifications = notifications.filter(n => n.notificationType === options.type);
      }

      const total = filteredNotifications.length;
      const unreadCount = notifications.filter(n => !n.isRead).length;

      if (options?.limit || options?.offset) {
        const offset = options.offset || 0;
        const limit = options.limit || 20;
        filteredNotifications = filteredNotifications.slice(offset, offset + limit);
      }

      return {
        notifications: filteredNotifications,
        total,
        unreadCount
      };
    } catch (error) {
      console.error('NotificationService: Failed to get user notifications:', error);
      return { notifications: [], total: 0, unreadCount: 0 };
    }
  }

  /**
   * Mark notification as read
   */
  static async markNotificationAsRead(notificationId: string): Promise<{ success: boolean }> {
    try {
      await storage.markNotificationAsRead(notificationId);
      return { success: true };
    } catch (error) {
      console.error('NotificationService: Failed to mark notification as read:', error);
      return { success: false };
    }
  }

  /**
   * Register WebSocket connection for real-time notifications
   */
  static registerWebSocketConnection(userId: string, connection: any): void {
    this.websocketConnections.set(userId, connection);
    console.log(`NotificationService: WebSocket registered for user ${userId}`);
  }

  /**
   * Unregister WebSocket connection
   */
  static unregisterWebSocketConnection(userId: string): void {
    this.websocketConnections.delete(userId);
    console.log(`NotificationService: WebSocket unregistered for user ${userId}`);
  }

  // Private helper methods

  private static async shouldSendNotification(
    userId: string,
    notificationType: string,
    preferences: NotificationPreferences
  ): Promise<{ send: boolean; reason?: string }> {
    // Check quiet hours
    if (this.isQuietHours(preferences.timing)) {
      return { send: false, reason: 'quiet_hours' };
    }

    // Check frequency preferences
    if (preferences.timing.frequency !== 'immediate') {
      return { send: false, reason: 'frequency_limit' };
    }

    return { send: true };
  }

  private static shouldSendEmailNotification(
    notificationType: string,
    preferences: NotificationPreferences
  ): boolean {
    const typeMap = {
      'status_change': preferences.email.statusChanges,
      'interview_reminder': preferences.email.interviews,
      'interview_scheduled': preferences.email.interviews,
      'follow_up_reminder': preferences.email.followUps,
      'follow_up_recommendation': preferences.email.followUps,
      'calendar_event': preferences.email.interviews
    };

    return typeMap[notificationType as keyof typeof typeMap] ?? true;
  }

  private static shouldSendPushNotification(
    notificationType: string,
    preferences: NotificationPreferences
  ): boolean {
    const typeMap = {
      'status_change': preferences.push.statusChanges,
      'interview_reminder': preferences.push.interviews,
      'interview_scheduled': preferences.push.interviews,
      'follow_up_reminder': preferences.push.followUps,
      'follow_up_recommendation': preferences.push.followUps,
      'calendar_event': preferences.push.interviews
    };

    return typeMap[notificationType as keyof typeof typeMap] ?? false;
  }

  private static isQuietHours(timing: NotificationPreferences['timing']): boolean {
    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    const { start, end } = timing.quietHours;
    
    // Handle quiet hours spanning midnight
    if (start > end) {
      return currentTime >= start || currentTime <= end;
    }
    
    return currentTime >= start && currentTime <= end;
  }

  private static async queueNotification(
    userId: string,
    notification: NotificationPayload
  ): Promise<void> {
    const queue = this.notificationQueue.get(userId) || [];
    queue.push(notification);
    this.notificationQueue.set(userId, queue);
  }

  private static async processQueuedNotifications(userId: string): Promise<void> {
    const queue = this.notificationQueue.get(userId);
    if (!queue || queue.length === 0) return;

    // Process all queued notifications
    for (const notification of queue) {
      try {
        await this.sendNotification(userId, notification);
      } catch (error) {
        console.error('NotificationService: Failed to process queued notification:', error);
      }
    }

    // Clear the queue
    this.notificationQueue.delete(userId);
  }

  private static async sendEmailNotification(
    userId: string,
    notification: NotificationPayload
  ): Promise<void> {
    const user = await storage.getUserById(userId);
    if (!user?.email) return;

    const htmlContent = this.generateNotificationEmailHTML(notification);
    
    await SendGridService.sendEmail({
      to: user.email,
      subject: notification.title,
      html: htmlContent,
      text: notification.message
    });
  }

  private static async sendPushNotification(
    userId: string,
    notification: NotificationPayload
  ): Promise<void> {
    // This would integrate with push notification services (FCM, APNS, etc.)
    // For now, we'll log it as a placeholder
    console.log(`Push notification for user ${userId}:`, {
      title: notification.title,
      message: notification.message,
      data: notification.data
    });
  }

  private static async sendInAppNotification(
    userId: string,
    notification: NotificationPayload
  ): Promise<void> {
    // Send real-time notification via WebSocket if connected
    const connection = this.websocketConnections.get(userId);
    if (connection) {
      try {
        connection.send(JSON.stringify({
          type: 'notification',
          ...notification
        }));
      } catch (error) {
        console.error('NotificationService: Failed to send WebSocket notification:', error);
      }
    }
  }

  private static generateNotificationEmailHTML(notification: NotificationPayload): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">${notification.title}</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px; line-height: 1.6; color: #333; margin: 0 0 20px 0;">
            ${notification.message}
          </p>
          ${notification.data?.jobTitle ? `
            <div style="background: white; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <strong>Position:</strong> ${notification.data.jobTitle}<br>
              <strong>Company:</strong> ${notification.data.company}
            </div>
          ` : ''}
          <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL || 'https://app.careercopilot.com'}/applications" 
               style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Application
            </a>
          </div>
        </div>
        <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
          <p>Career Co-Pilot | Your AI-Powered Job Search Assistant</p>
        </div>
      </div>
    `;
  }

  private static generateICalData(event: CalendarEvent): string {
    const formatDate = (date: Date) => {
      return date.toISOString().replace(/[:-]/g, '').replace(/\.\d{3}/, '');
    };

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Career Co-Pilot//Interview Calendar//EN',
      'BEGIN:VEVENT',
      `DTSTART:${formatDate(event.startTime)}`,
      `DTEND:${formatDate(event.endTime)}`,
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${event.description}`,
      ...(event.location ? [`LOCATION:${event.location}`] : []),
      ...(event.reminders?.map(r => `BEGIN:VALARM\nTRIGGER:-PT${r.minutes}M\nACTION:DISPLAY\nDESCRIPTION:${event.title}\nEND:VALARM`) || []),
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\n');
  }
}