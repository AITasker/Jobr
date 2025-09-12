import { storage } from './storage';
import type { User, PlanType } from '@shared/schema';

export interface PlanLimits {
  monthlyApplications: number; // -1 means unlimited
  aiFeatures: boolean;
  prioritySupport: boolean;
  advancedAnalytics: boolean;
  interviewPrep: boolean;
  premiumTemplates: boolean;
}

export class SubscriptionService {
  private static PLAN_LIMITS: Record<PlanType, PlanLimits> = {
    Free: {
      monthlyApplications: 5,
      aiFeatures: false,
      prioritySupport: false,
      advancedAnalytics: false,
      interviewPrep: false,
      premiumTemplates: false,
    },
    Premium: {
      monthlyApplications: -1, // unlimited
      aiFeatures: true,
      prioritySupport: true,
      advancedAnalytics: false,
      interviewPrep: false,
      premiumTemplates: false,
    },
    Pro: {
      monthlyApplications: -1, // unlimited
      aiFeatures: true,
      prioritySupport: true,
      advancedAnalytics: true,
      interviewPrep: true,
      premiumTemplates: true,
    },
  };

  static getPlanLimits(plan: PlanType): PlanLimits {
    return this.PLAN_LIMITS[plan];
  }

  static async canUserCreateApplication(userId: string): Promise<{
    allowed: boolean;
    reason?: string;
    currentUsage?: number;
    limit?: number;
  }> {
    try {
      const user = await storage.getUser(userId);
      if (!user) {
        return { allowed: false, reason: 'User not found' };
      }

      const limits = this.getPlanLimits(user.plan as PlanType);
      
      // Check if plan allows unlimited applications
      if (limits.monthlyApplications === -1) {
        return { allowed: true };
      }

      // Check monthly application limit
      const now = new Date();
      const resetDate = user.monthlyApplicationsReset || user.createdAt;
      const daysSinceReset = Math.floor((now.getTime() - resetDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Reset monthly count if it's been more than 30 days
      if (daysSinceReset >= 30) {
        await storage.resetMonthlyApplicationCount(userId);
        return { 
          allowed: true, 
          currentUsage: 0, 
          limit: limits.monthlyApplications 
        };
      }

      const currentUsage = user.applicationsThisMonth;
      if (currentUsage >= limits.monthlyApplications) {
        return {
          allowed: false,
          reason: 'Monthly application limit reached',
          currentUsage,
          limit: limits.monthlyApplications
        };
      }

      return { 
        allowed: true, 
        currentUsage, 
        limit: limits.monthlyApplications 
      };
    } catch (error) {
      console.error('Error checking application limits:', error);
      return { allowed: false, reason: 'Error checking limits' };
    }
  }

  static async canUserAccessAIFeatures(userId: string): Promise<{
    allowed: boolean;
    reason?: string;
    requiresUpgrade?: boolean;
  }> {
    try {
      const user = await storage.getUser(userId);
      if (!user) {
        return { allowed: false, reason: 'User not found' };
      }

      const limits = this.getPlanLimits(user.plan as PlanType);
      
      if (!limits.aiFeatures) {
        return {
          allowed: false,
          reason: 'AI features require Premium or Pro subscription',
          requiresUpgrade: true
        };
      }

      return { allowed: true };
    } catch (error) {
      console.error('Error checking AI feature access:', error);
      return { allowed: false, reason: 'Error checking feature access' };
    }
  }

  static async canUserAccessAdvancedAnalytics(userId: string): Promise<{
    allowed: boolean;
    reason?: string;
    requiresUpgrade?: boolean;
  }> {
    try {
      const user = await storage.getUser(userId);
      if (!user) {
        return { allowed: false, reason: 'User not found' };
      }

      const limits = this.getPlanLimits(user.plan as PlanType);
      
      if (!limits.advancedAnalytics) {
        return {
          allowed: false,
          reason: 'Advanced analytics require Pro subscription',
          requiresUpgrade: true
        };
      }

      return { allowed: true };
    } catch (error) {
      console.error('Error checking analytics access:', error);
      return { allowed: false, reason: 'Error checking feature access' };
    }
  }

  static async recordApplicationCreated(userId: string): Promise<void> {
    try {
      await storage.incrementUserApplicationCount(userId);
    } catch (error) {
      console.error('Error recording application creation:', error);
    }
  }

  static async getUserUsageStats(userId: string): Promise<{
    currentPlan: PlanType;
    applicationsThisMonth: number;
    applicationLimit: number;
    remainingApplications: number;
    hasAIFeatures: boolean;
    hasAdvancedAnalytics: boolean;
    hasInterviewPrep: boolean;
    daysSinceReset: number;
    nextResetDate: Date;
  } | null> {
    try {
      const user = await storage.getUser(userId);
      if (!user) return null;

      const limits = this.getPlanLimits(user.plan as PlanType);
      const now = new Date();
      const resetDate = user.monthlyApplicationsReset || user.createdAt;
      const daysSinceReset = Math.floor((now.getTime() - resetDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Calculate next reset date (30 days from last reset)
      const nextResetDate = new Date(resetDate);
      nextResetDate.setDate(nextResetDate.getDate() + 30);

      const applicationLimit = limits.monthlyApplications === -1 ? 999999 : limits.monthlyApplications;
      const applicationsThisMonth = daysSinceReset >= 30 ? 0 : user.applicationsThisMonth;
      const remainingApplications = limits.monthlyApplications === -1 
        ? -1 // unlimited
        : Math.max(0, applicationLimit - applicationsThisMonth);

      return {
        currentPlan: user.plan as PlanType,
        applicationsThisMonth,
        applicationLimit,
        remainingApplications,
        hasAIFeatures: limits.aiFeatures,
        hasAdvancedAnalytics: limits.advancedAnalytics,
        hasInterviewPrep: limits.interviewPrep,
        daysSinceReset,
        nextResetDate
      };
    } catch (error) {
      console.error('Error getting usage stats:', error);
      return null;
    }
  }
}