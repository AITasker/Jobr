import { storage } from "./storage";
import { EmailMonitoringService } from "./emailMonitoringService";
import type { 
  Application, 
  User, 
  Job,
  InsertApplicationHistory,
  InsertApplicationNotification,
  InsertEmployerInteraction,
  InsertApplicationAnalytics 
} from "@shared/schema";

export interface ApplicationStatusUpdate {
  applicationId: string;
  newStatus: string;
  reason?: string;
  metadata?: any;
  notes?: string;
  scheduledDate?: Date;
}

export interface FollowUpRecommendation {
  applicationId: string;
  type: 'follow_up_email' | 'status_check' | 'withdrawal' | 'reapplication';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  reason: string;
  suggestedDate: Date;
  suggestedAction: string;
  metadata?: any;
}

export interface ApplicationInsights {
  applicationId: string;
  userId: string;
  successPrediction: number;
  recommendedActions: FollowUpRecommendation[];
  timeToResponse?: number;
  engagementScore: number;
  competitiveAnalysis?: {
    similarApplications: number;
    averageResponseTime: number;
    successRate: number;
  };
}

/**
 * Comprehensive Application Lifecycle Management Service
 * Manages the entire application workflow from application to final outcome
 */
export class ApplicationLifecycleService {
  
  /**
   * Update application status with comprehensive tracking
   */
  static async updateApplicationStatus(update: ApplicationStatusUpdate): Promise<{
    success: boolean;
    message: string;
    application?: Application;
  }> {
    try {
      const application = await storage.getApplicationWithJob(update.applicationId);
      if (!application) {
        return { success: false, message: 'Application not found' };
      }

      const previousStatus = application.status;
      const updates: Partial<Application> = {
        status: update.newStatus as any,
        lastStatusChangeAt: new Date(),
        updatedAt: new Date()
      };

      // Status-specific updates
      switch (update.newStatus) {
        case 'viewed':
          updates.viewedByEmployerAt = new Date();
          updates.employerInteractionScore = (application.employerInteractionScore || 0) + 15;
          break;
          
        case 'interview_scheduled':
          updates.interviewScheduledAt = new Date();
          updates.interviewDate = update.scheduledDate;
          if (update.scheduledDate) {
            // Schedule interview reminder
            await this.scheduleInterviewReminder(application, update.scheduledDate);
          }
          break;
          
        case 'interviewing':
          updates.employerInteractionScore = (application.employerInteractionScore || 0) + 50;
          break;
          
        case 'interview_completed':
          updates.interviewCompletedAt = new Date();
          // Schedule follow-up reminder
          await this.scheduleFollowUpReminder(application, 'post_interview');
          break;
          
        case 'offered':
          updates.offerReceivedAt = new Date();
          // High success score
          updates.employerInteractionScore = (application.employerInteractionScore || 0) + 100;
          break;
          
        case 'rejected':
          updates.rejectedAt = new Date();
          // Analyze rejection for insights
          await this.analyzeRejection(application, update.reason, update.metadata);
          break;
          
        case 'withdrawn':
          updates.withdrawnAt = new Date();
          break;
      }

      // Update application
      const updatedApplication = await storage.updateApplication(update.applicationId, updates);

      // Record status change in history
      await storage.createApplicationHistory({
        applicationId: update.applicationId,
        userId: application.userId,
        previousStatus,
        newStatus: update.newStatus,
        changeReason: update.reason || 'manual_update',
        metadata: update.metadata,
        notes: update.notes
      });

      // Create notification for status change
      await this.createStatusChangeNotification(updatedApplication, previousStatus, update.newStatus);

      // Update analytics
      await this.updateApplicationAnalytics(updatedApplication, 'status_change', {
        previousStatus,
        newStatus: update.newStatus,
        reason: update.reason
      });

      // Trigger follow-up recommendations
      await this.generateFollowUpRecommendations(updatedApplication);

      return {
        success: true,
        message: `Application status updated from ${previousStatus} to ${update.newStatus}`,
        application: updatedApplication
      };

    } catch (error: any) {
      console.error('ApplicationLifecycleService: Failed to update status:', error);
      return {
        success: false,
        message: error.message || 'Failed to update application status'
      };
    }
  }

  /**
   * Schedule interview with comprehensive tracking
   */
  static async scheduleInterview(
    applicationId: string,
    interviewDate: Date,
    interviewType: 'phone' | 'video' | 'in_person' | 'technical' | 'panel',
    details?: {
      interviewer?: string;
      location?: string;
      duration?: number;
      preparationNotes?: string;
      meetingLink?: string;
    }
  ): Promise<{ success: boolean; message: string }> {
    try {
      const application = await storage.getApplicationWithJob(applicationId);
      if (!application) {
        return { success: false, message: 'Application not found' };
      }

      // Update application status
      await this.updateApplicationStatus({
        applicationId,
        newStatus: 'interview_scheduled',
        scheduledDate: interviewDate,
        reason: 'interview_scheduled',
        metadata: {
          interviewType,
          details
        }
      });

      // Create interview preparation notification
      await storage.createApplicationNotification({
        applicationId,
        userId: application.userId,
        notificationType: 'interview_preparation',
        title: `Interview Scheduled: ${application.job.title}`,
        message: `Your ${interviewType} interview for ${application.job.title} at ${application.job.company} is scheduled for ${interviewDate.toLocaleDateString()}.`,
        scheduledFor: new Date(interviewDate.getTime() - 24 * 60 * 60 * 1000), // 1 day before
        metadata: {
          interviewType,
          details,
          interviewDate
        }
      });

      // Schedule reminder 2 hours before interview
      await storage.createApplicationNotification({
        applicationId,
        userId: application.userId,
        notificationType: 'interview_reminder',
        title: `Interview Reminder: ${application.job.title}`,
        message: `Your ${interviewType} interview starts in 2 hours. Good luck!`,
        scheduledFor: new Date(interviewDate.getTime() - 2 * 60 * 60 * 1000),
        metadata: {
          interviewType,
          details,
          interviewDate
        }
      });

      return {
        success: true,
        message: 'Interview scheduled successfully with reminders'
      };

    } catch (error: any) {
      console.error('ApplicationLifecycleService: Failed to schedule interview:', error);
      return {
        success: false,
        message: error.message || 'Failed to schedule interview'
      };
    }
  }

  /**
   * Generate follow-up recommendations based on application data
   */
  static async generateFollowUpRecommendations(application: Application): Promise<FollowUpRecommendation[]> {
    try {
      const recommendations: FollowUpRecommendation[] = [];
      const now = new Date();
      const appliedDate = new Date(application.appliedDate);
      const daysSinceApplied = Math.floor((now.getTime() - appliedDate.getTime()) / (1000 * 60 * 60 * 24));

      // Email follow-up recommendations
      if (application.status === 'applied' && application.emailSentAt) {
        const daysSinceEmail = Math.floor((now.getTime() - new Date(application.emailSentAt).getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysSinceEmail >= 7 && !application.followUpReminderSent) {
          recommendations.push({
            applicationId: application.id,
            type: 'follow_up_email',
            priority: daysSinceEmail >= 14 ? 'high' : 'medium',
            reason: `No response after ${daysSinceEmail} days`,
            suggestedDate: new Date(now.getTime() + 24 * 60 * 60 * 1000), // Tomorrow
            suggestedAction: 'Send a polite follow-up email expressing continued interest'
          });
        }
      }

      // Status check recommendations
      if (application.status === 'viewed' && daysSinceApplied >= 10) {
        recommendations.push({
          applicationId: application.id,
          type: 'status_check',
          priority: daysSinceApplied >= 21 ? 'high' : 'medium',
          reason: `Application viewed but no progress for ${daysSinceApplied} days`,
          suggestedDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), // In 2 days
          suggestedAction: 'Check application status or send a brief inquiry'
        });
      }

      // Withdrawal recommendations for old applications
      if (application.status === 'applied' && daysSinceApplied >= 45) {
        recommendations.push({
          applicationId: application.id,
          type: 'withdrawal',
          priority: 'low',
          reason: `No response for ${daysSinceApplied} days`,
          suggestedDate: new Date(),
          suggestedAction: 'Consider withdrawing and applying to similar positions elsewhere'
        });
      }

      // Post-interview follow-up
      if (application.status === 'interview_completed' && application.interviewCompletedAt) {
        const daysSinceInterview = Math.floor((now.getTime() - new Date(application.interviewCompletedAt).getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysSinceInterview >= 3 && daysSinceInterview <= 7) {
          recommendations.push({
            applicationId: application.id,
            type: 'follow_up_email',
            priority: 'high',
            reason: `${daysSinceInterview} days since interview completion`,
            suggestedDate: new Date(),
            suggestedAction: 'Send thank you note and express continued interest'
          });
        }
      }

      // Store recommendations as notifications
      for (const rec of recommendations) {
        await storage.createApplicationNotification({
          applicationId: rec.applicationId,
          userId: application.userId,
          notificationType: 'follow_up_recommendation',
          title: `Recommendation: ${rec.suggestedAction}`,
          message: `${rec.reason}. Priority: ${rec.priority}`,
          scheduledFor: rec.suggestedDate,
          metadata: rec
        });
      }

      return recommendations;

    } catch (error) {
      console.error('ApplicationLifecycleService: Failed to generate recommendations:', error);
      return [];
    }
  }

  /**
   * Withdraw application with proper cleanup
   */
  static async withdrawApplication(
    applicationId: string,
    reason: string,
    notifyEmployer: boolean = false
  ): Promise<{ success: boolean; message: string }> {
    try {
      const application = await storage.getApplicationWithJob(applicationId);
      if (!application) {
        return { success: false, message: 'Application not found' };
      }

      // Update status to withdrawn
      await this.updateApplicationStatus({
        applicationId,
        newStatus: 'withdrawn',
        reason,
        metadata: { notifyEmployer }
      });

      // Cancel future notifications for this application
      const notifications = await storage.getApplicationNotificationsByUserId(application.userId);
      const applicationNotifications = notifications.filter(n => 
        n.applicationId === applicationId && !n.sentAt && n.isActive
      );

      for (const notification of applicationNotifications) {
        await storage.updateApplicationNotification(notification.id, { isActive: false });
      }

      // Optionally send withdrawal notification to employer
      if (notifyEmployer && application.emailSentAt) {
        // This would integrate with email service to send withdrawal notice
        // Implementation depends on business requirements
      }

      return {
        success: true,
        message: 'Application withdrawn successfully'
      };

    } catch (error: any) {
      console.error('ApplicationLifecycleService: Failed to withdraw application:', error);
      return {
        success: false,
        message: error.message || 'Failed to withdraw application'
      };
    }
  }

  /**
   * Get application insights and analytics
   */
  static async getApplicationInsights(applicationId: string): Promise<ApplicationInsights | null> {
    try {
      const application = await storage.getApplicationWithJob(applicationId);
      if (!application) {
        return null;
      }

      const history = await storage.getApplicationHistoryByApplicationId(applicationId);
      const emailEvents = await storage.getEmailEventsByApplication(applicationId);
      const employerInteractions = await storage.getEmployerInteractionsByApplicationId(applicationId);

      // Calculate engagement score
      const engagementScore = this.calculateEngagementScore(application, emailEvents, employerInteractions);

      // Calculate success prediction
      const successPrediction = this.calculateSuccessPrediction(application, history, engagementScore);

      // Generate recommendations
      const recommendations = await this.generateFollowUpRecommendations(application);

      // Calculate time to response if available
      let timeToResponse: number | undefined;
      if (application.emailSentAt && application.emailRepliedAt) {
        timeToResponse = new Date(application.emailRepliedAt).getTime() - new Date(application.emailSentAt).getTime();
        timeToResponse = Math.floor(timeToResponse / (1000 * 60 * 60 * 24)); // Days
      }

      return {
        applicationId,
        userId: application.userId,
        successPrediction,
        recommendedActions: recommendations,
        timeToResponse,
        engagementScore
      };

    } catch (error) {
      console.error('ApplicationLifecycleService: Failed to get application insights:', error);
      return null;
    }
  }

  /**
   * Bulk update applications (useful for batch operations)
   */
  static async bulkUpdateApplications(
    applicationIds: string[],
    updates: Partial<Application>,
    reason?: string
  ): Promise<{ success: boolean; updated: number; errors: string[] }> {
    const results = {
      success: true,
      updated: 0,
      errors: [] as string[]
    };

    for (const applicationId of applicationIds) {
      try {
        await storage.updateApplication(applicationId, {
          ...updates,
          updatedAt: new Date()
        });

        // Record bulk update in history
        if (updates.status) {
          const application = await storage.getApplicationWithJob(applicationId);
          if (application) {
            await storage.createApplicationHistory({
              applicationId,
              userId: application.userId,
              previousStatus: application.status,
              newStatus: updates.status,
              changeReason: reason || 'bulk_update',
              metadata: { bulkOperation: true, updates }
            });
          }
        }

        results.updated++;
      } catch (error: any) {
        results.errors.push(`${applicationId}: ${error.message}`);
        results.success = false;
      }
    }

    return results;
  }

  /**
   * Get comprehensive application timeline
   */
  static async getApplicationTimeline(applicationId: string): Promise<{
    milestones: Array<{
      date: Date;
      type: string;
      title: string;
      description: string;
      metadata?: any;
    }>;
  }> {
    try {
      const application = await storage.getApplicationWithJob(applicationId);
      const history = await storage.getApplicationHistoryByApplicationId(applicationId);
      const emailEvents = await storage.getEmailEventsByApplication(applicationId);
      const employerInteractions = await storage.getEmployerInteractionsByApplicationId(applicationId);

      const milestones = [];

      // Application submitted
      milestones.push({
        date: new Date(application.appliedDate),
        type: 'application',
        title: 'Application Submitted',
        description: `Applied for ${application.job.title} at ${application.job.company}`
      });

      // Email events
      for (const event of emailEvents) {
        milestones.push({
          date: new Date(event.timestamp),
          type: 'email',
          title: `Email ${event.eventType.charAt(0).toUpperCase() + event.eventType.slice(1)}`,
          description: `Application email ${event.eventType}`,
          metadata: event.metadata
        });
      }

      // Status changes from history
      for (const change of history) {
        milestones.push({
          date: new Date(change.createdAt),
          type: 'status_change',
          title: `Status Changed`,
          description: `${change.previousStatus || 'Unknown'} → ${change.newStatus}`,
          metadata: change.metadata
        });
      }

      // Employer interactions
      for (const interaction of employerInteractions) {
        milestones.push({
          date: new Date(interaction.timestamp),
          type: 'interaction',
          title: 'Employer Interaction',
          description: `${interaction.interactionType.replace('_', ' ')}`,
          metadata: interaction.interactionData
        });
      }

      // Sort by date
      milestones.sort((a, b) => a.date.getTime() - b.date.getTime());

      return { milestones };

    } catch (error) {
      console.error('ApplicationLifecycleService: Failed to get application timeline:', error);
      return { milestones: [] };
    }
  }

  // Private helper methods

  private static calculateEngagementScore(
    application: Application,
    emailEvents: any[],
    employerInteractions: any[]
  ): number {
    let score = 0;

    // Base score from current interaction score
    score += application.employerInteractionScore || 0;

    // Email engagement
    const opens = emailEvents.filter(e => e.eventType === 'open').length;
    const clicks = emailEvents.filter(e => e.eventType === 'click').length;
    const replies = emailEvents.filter(e => e.eventType === 'replied').length;

    score += opens * 5 + clicks * 10 + replies * 25;

    // Direct employer interactions
    score += employerInteractions.length * 15;

    // Status progression bonus
    const statusScores = {
      'applied': 0,
      'viewed': 20,
      'interview_scheduled': 50,
      'interviewing': 70,
      'interview_completed': 80,
      'offered': 100
    };

    score += statusScores[application.status as keyof typeof statusScores] || 0;

    return Math.min(score, 200); // Cap at 200
  }

  private static calculateSuccessPrediction(
    application: Application,
    history: any[],
    engagementScore: number
  ): number {
    let prediction = 0;

    // Base prediction from engagement score
    prediction += engagementScore / 200 * 50; // 50% from engagement

    // Status-based prediction
    const statusPredictions = {
      'applied': 15,
      'viewed': 30,
      'interview_scheduled': 60,
      'interviewing': 75,
      'interview_completed': 80,
      'offered': 95,
      'rejected': 0,
      'withdrawn': 0
    };

    prediction += statusPredictions[application.status as keyof typeof statusPredictions] || 0;

    // Time factor (applications lose probability over time)
    const daysSinceApplied = Math.floor(
      (new Date().getTime() - new Date(application.appliedDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysSinceApplied > 30) {
      prediction *= 0.8; // 20% reduction after 30 days
    }
    if (daysSinceApplied > 60) {
      prediction *= 0.6; // Additional 40% reduction after 60 days
    }

    return Math.min(Math.max(prediction, 0), 100); // Between 0-100
  }

  private static async scheduleInterviewReminder(
    application: Application,
    interviewDate: Date
  ): Promise<void> {
    // Schedule reminder 24 hours before
    const reminderDate = new Date(interviewDate.getTime() - 24 * 60 * 60 * 1000);
    
    await storage.createApplicationNotification({
      applicationId: application.id,
      userId: application.userId,
      notificationType: 'interview_reminder',
      title: 'Interview Tomorrow',
      message: `Your interview for ${application.job.title} at ${application.job.company} is tomorrow at ${interviewDate.toLocaleTimeString()}.`,
      scheduledFor: reminderDate,
      metadata: { interviewDate }
    });
  }

  private static async scheduleFollowUpReminder(
    application: Application,
    type: string
  ): Promise<void> {
    const reminderDate = new Date();
    reminderDate.setDate(reminderDate.getDate() + 3); // 3 days later

    await storage.createApplicationNotification({
      applicationId: application.id,
      userId: application.userId,
      notificationType: 'follow_up_reminder',
      title: 'Follow-up Reminder',
      message: `Consider following up on your ${type} for ${application.job.title} at ${application.job.company}.`,
      scheduledFor: reminderDate,
      metadata: { type }
    });
  }

  private static async analyzeRejection(
    application: Application,
    reason?: string,
    metadata?: any
  ): Promise<void> {
    // Store rejection analytics for learning
    await storage.createApplicationAnalytics({
      applicationId: application.id,
      userId: application.userId,
      metric: 'rejection_analysis',
      value: 1,
      metadata: {
        reason,
        metadata,
        applicationData: {
          matchScore: application.matchScore,
          preparationStatus: application.preparationStatus,
          daysSinceApplied: Math.floor(
            (new Date().getTime() - new Date(application.appliedDate).getTime()) / (1000 * 60 * 60 * 24)
          )
        }
      }
    });
  }

  private static async createStatusChangeNotification(
    application: Application,
    previousStatus: string,
    newStatus: string
  ): Promise<void> {
    const statusMessages = {
      'viewed': 'Your application has been viewed by the employer!',
      'interview_scheduled': 'Interview scheduled! Check your email for details.',
      'interviewing': 'Your interview is in progress. Good luck!',
      'interview_completed': 'Interview completed. Following up is recommended.',
      'offered': '🎉 Congratulations! You received a job offer!',
      'rejected': 'Unfortunately, this application was not successful.',
      'withdrawn': 'Application has been withdrawn.'
    };

    const message = statusMessages[newStatus as keyof typeof statusMessages] || 
                   `Application status changed from ${previousStatus} to ${newStatus}`;

    await storage.createApplicationNotification({
      applicationId: application.id,
      userId: application.userId,
      notificationType: 'status_change',
      title: `Status Update: ${application.job.title}`,
      message,
      scheduledFor: new Date(),
      metadata: {
        previousStatus,
        newStatus,
        jobTitle: application.job.title,
        company: application.job.company
      }
    });
  }

  private static async updateApplicationAnalytics(
    application: Application,
    metric: string,
    metadata: any
  ): Promise<void> {
    await storage.createApplicationAnalytics({
      applicationId: application.id,
      userId: application.userId,
      metric,
      value: 1,
      metadata: {
        ...metadata,
        timestamp: new Date()
      }
    });
  }
}