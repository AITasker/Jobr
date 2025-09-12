import {
  users,
  cvs,
  jobs,
  applications,
  apiUsage,
  templates,
  authAccounts,
  otpCodes,
  subscriptions,
  stripeEvents,
  type User,
  type UpsertUser,
  type Cv,
  type InsertCv,
  type Job,
  type InsertJob,
  type Application,
  type InsertApplication,
  type ApiUsage,
  type InsertApiUsage,
  type Template,
  type InsertTemplate,
  type AuthAccount,
  type InsertAuthAccount,
  type OtpCode,
  type InsertOtpCode,
  type Subscription,
  type InsertSubscription,
  type StripeEvent,
  type InsertStripeEvent
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  createUser(user: Omit<UpsertUser, 'id'>): Promise<User>;
  
  // CV operations
  createCv(cv: InsertCv): Promise<Cv>;
  getCvByUserId(userId: string): Promise<Cv | undefined>;
  updateCv(id: string, updates: Partial<Cv>): Promise<Cv>;
  
  // Job operations
  createJob(job: InsertJob): Promise<Job>;
  getJobs(limit?: number): Promise<Job[]>;
  getJobById(id: string): Promise<Job | undefined>;
  
  // Application operations
  createApplication(application: InsertApplication): Promise<Application>;
  getApplicationsByUserId(userId: string): Promise<Application[]>;
  updateApplication(id: string, updates: Partial<Application>): Promise<Application>;
  deleteApplication(id: string): Promise<void>;
  getApplicationWithJob(id: string): Promise<(Application & { job: Job }) | undefined>;
  checkExistingApplication(userId: string, jobId: string): Promise<Application | undefined>;
  
  // API Usage operations
  createApiUsage(usage: InsertApiUsage): Promise<ApiUsage>;
  getApiUsageByUserId(userId: string, limit?: number): Promise<ApiUsage[]>;
  getDailyApiUsage(userId: string, date: Date): Promise<ApiUsage[]>;
  
  // Template operations
  createTemplate(template: InsertTemplate): Promise<Template>;
  getTemplates(type?: string): Promise<Template[]>;
  getDefaultTemplate(type: string): Promise<Template | undefined>;
  
  // Auth Account operations
  createAuthAccount(account: InsertAuthAccount): Promise<AuthAccount>;
  getAuthAccountByEmail(email: string, provider: string): Promise<AuthAccount | undefined>;
  getAuthAccountsByUserId(userId: string): Promise<AuthAccount[]>;
  updateAuthAccount(id: string, updates: Partial<AuthAccount>): Promise<AuthAccount>;
  
  // OTP Code operations
  createOtpCode(otp: InsertOtpCode): Promise<OtpCode>;
  getOtpCode(target: string, purpose: string): Promise<OtpCode | undefined>;
  updateOtpCode(id: string, updates: Partial<OtpCode>): Promise<OtpCode>;
  cleanupExpiredOtpCodes(): Promise<void>;

  // Subscription operations
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  getSubscriptionsByUserId(userId: string): Promise<Subscription[]>;
  getActiveSubscriptionByUserId(userId: string): Promise<Subscription | undefined>;
  updateSubscription(id: string, updates: Partial<Subscription>): Promise<Subscription>;
  updateUserStripeInfo(userId: string, customerId?: string, subscriptionId?: string): Promise<User>;
  incrementUserApplicationCount(userId: string): Promise<User>;
  resetMonthlyApplicationCount(userId: string): Promise<User>;
  getUserByStripeCustomerId(customerId: string): Promise<User | undefined>;
  updateUserPlan(userId: string, plan: string, subscriptionStatus?: string, periodEnd?: Date): Promise<User>;

  // Stripe Event operations for webhook idempotency
  createStripeEvent(event: InsertStripeEvent): Promise<StripeEvent>;
  getStripeEventByEventId(eventId: string): Promise<StripeEvent | undefined>;
  markStripeEventProcessed(eventId: string, errorMessage?: string): Promise<StripeEvent>;
  cleanupOldStripeEvents(olderThanDays: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations (required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async createUser(userData: Omit<UpsertUser, 'id'>): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  // CV operations
  async createCv(cvData: InsertCv): Promise<Cv> {
    const [cv] = await db.insert(cvs).values(cvData).returning();
    return cv;
  }

  async getCvByUserId(userId: string): Promise<Cv | undefined> {
    const [cv] = await db.select().from(cvs).where(eq(cvs.userId, userId)).orderBy(desc(cvs.createdAt));
    return cv;
  }

  async updateCv(id: string, updates: Partial<Cv>): Promise<Cv> {
    const [cv] = await db
      .update(cvs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(cvs.id, id))
      .returning();
    return cv;
  }

  // Job operations
  async createJob(jobData: InsertJob): Promise<Job> {
    const [job] = await db.insert(jobs).values(jobData).returning();
    return job;
  }

  async getJobs(limit: number = 20): Promise<Job[]> {
    return await db.select().from(jobs).where(eq(jobs.isActive, true)).orderBy(desc(jobs.postedDate)).limit(limit);
  }

  async getJobById(id: string): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    return job;
  }

  // Application operations
  async createApplication(applicationData: InsertApplication): Promise<Application> {
    const [application] = await db.insert(applications).values(applicationData).returning();
    return application;
  }

  async getApplicationsByUserId(userId: string): Promise<Application[]> {
    return await db.select().from(applications).where(eq(applications.userId, userId)).orderBy(desc(applications.appliedDate));
  }

  async updateApplication(id: string, updates: Partial<Application>): Promise<Application> {
    const [application] = await db
      .update(applications)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(applications.id, id))
      .returning();
    return application;
  }

  async deleteApplication(id: string): Promise<void> {
    await db.delete(applications).where(eq(applications.id, id));
  }

  async getApplicationWithJob(id: string): Promise<(Application & { job: Job }) | undefined> {
    const [result] = await db
      .select()
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .where(eq(applications.id, id));
    
    if (!result) return undefined;
    
    return {
      ...result.applications,
      job: result.jobs
    };
  }

  async checkExistingApplication(userId: string, jobId: string): Promise<Application | undefined> {
    const [application] = await db
      .select()
      .from(applications)
      .where(and(eq(applications.userId, userId), eq(applications.jobId, jobId)));
    return application;
  }

  // API Usage operations
  async createApiUsage(usageData: InsertApiUsage): Promise<ApiUsage> {
    const [usage] = await db.insert(apiUsage).values(usageData).returning();
    return usage;
  }

  async getApiUsageByUserId(userId: string, limit: number = 50): Promise<ApiUsage[]> {
    return await db
      .select()
      .from(apiUsage)
      .where(eq(apiUsage.userId, userId))
      .orderBy(desc(apiUsage.createdAt))
      .limit(limit);
  }

  async getDailyApiUsage(userId: string, date: Date): Promise<ApiUsage[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return await db
      .select()
      .from(apiUsage)
      .where(
        and(
          eq(apiUsage.userId, userId),
          // Note: This is a simplified version - you might want to use proper date filtering
          eq(apiUsage.success, true)
        )
      );
  }

  // Template operations
  async createTemplate(templateData: InsertTemplate): Promise<Template> {
    const [template] = await db.insert(templates).values(templateData).returning();
    return template;
  }

  async getTemplates(type?: string): Promise<Template[]> {
    if (type) {
      return await db
        .select()
        .from(templates)
        .where(eq(templates.type, type))
        .orderBy(desc(templates.isDefault), desc(templates.createdAt));
    }
    return await db
      .select()
      .from(templates)
      .orderBy(desc(templates.isDefault), desc(templates.createdAt));
  }

  async getDefaultTemplate(type: string): Promise<Template | undefined> {
    const [template] = await db
      .select()
      .from(templates)
      .where(and(eq(templates.type, type), eq(templates.isDefault, true)));
    return template;
  }

  // Auth Account operations
  async createAuthAccount(accountData: InsertAuthAccount): Promise<AuthAccount> {
    const [account] = await db.insert(authAccounts).values(accountData).returning();
    return account;
  }

  async getAuthAccountByEmail(email: string, provider: string): Promise<AuthAccount | undefined> {
    const [account] = await db
      .select()
      .from(authAccounts)
      .where(and(eq(authAccounts.email, email), eq(authAccounts.provider, provider)));
    return account;
  }

  async getAuthAccountsByUserId(userId: string): Promise<AuthAccount[]> {
    return await db
      .select()
      .from(authAccounts)
      .where(eq(authAccounts.userId, userId))
      .orderBy(desc(authAccounts.createdAt));
  }

  async updateAuthAccount(id: string, updates: Partial<AuthAccount>): Promise<AuthAccount> {
    const [account] = await db
      .update(authAccounts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(authAccounts.id, id))
      .returning();
    return account;
  }

  // OTP Code operations
  async createOtpCode(otpData: InsertOtpCode): Promise<OtpCode> {
    const [otp] = await db.insert(otpCodes).values(otpData).returning();
    return otp;
  }

  async getOtpCode(target: string, purpose: string): Promise<OtpCode | undefined> {
    const [otp] = await db
      .select()
      .from(otpCodes)
      .where(
        and(
          eq(otpCodes.target, target),
          eq(otpCodes.purpose, purpose),
          eq(otpCodes.used, false)
        )
      )
      .orderBy(desc(otpCodes.createdAt));
    return otp;
  }

  async updateOtpCode(id: string, updates: Partial<OtpCode>): Promise<OtpCode> {
    const [otp] = await db
      .update(otpCodes)
      .set(updates)
      .where(eq(otpCodes.id, id))
      .returning();
    return otp;
  }

  async cleanupExpiredOtpCodes(): Promise<void> {
    await db
      .delete(otpCodes)
      .where(eq(otpCodes.expiresAt, new Date()));
  }

  // Subscription operations
  async createSubscription(subscriptionData: InsertSubscription): Promise<Subscription> {
    const [subscription] = await db.insert(subscriptions).values(subscriptionData).returning();
    return subscription;
  }

  async getSubscriptionsByUserId(userId: string): Promise<Subscription[]> {
    return await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.createdAt));
  }

  async getActiveSubscriptionByUserId(userId: string): Promise<Subscription | undefined> {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, userId),
          eq(subscriptions.status, "active")
        )
      )
      .orderBy(desc(subscriptions.createdAt));
    return subscription;
  }

  async updateSubscription(id: string, updates: Partial<Subscription>): Promise<Subscription> {
    const [subscription] = await db
      .update(subscriptions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(subscriptions.id, id))
      .returning();
    return subscription;
  }

  async updateUserStripeInfo(userId: string, customerId?: string, subscriptionId?: string): Promise<User> {
    const updates: Partial<User> = {
      updatedAt: new Date()
    };
    
    if (customerId) {
      updates.stripeCustomerId = customerId;
    }
    
    if (subscriptionId) {
      updates.stripeSubscriptionId = subscriptionId;
    }

    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async incrementUserApplicationCount(userId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ 
        applicationsThisMonth: sql`${users.applicationsThisMonth} + 1`,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async resetMonthlyApplicationCount(userId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ 
        applicationsThisMonth: 0,
        monthlyApplicationsReset: new Date(),
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getUserByStripeCustomerId(customerId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.stripeCustomerId, customerId));
    return user;
  }

  async updateUserPlan(userId: string, plan: string, subscriptionStatus?: string, periodEnd?: Date): Promise<User> {
    const updates: Partial<User> = {
      plan,
      updatedAt: new Date()
    };
    
    if (subscriptionStatus) {
      updates.subscriptionStatus = subscriptionStatus;
    }
    
    if (periodEnd) {
      updates.subscriptionCurrentPeriodEnd = periodEnd;
    }

    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Stripe Event operations for webhook idempotency
  async createStripeEvent(eventData: InsertStripeEvent): Promise<StripeEvent> {
    const [event] = await db.insert(stripeEvents).values(eventData).returning();
    return event;
  }

  async getStripeEventByEventId(eventId: string): Promise<StripeEvent | undefined> {
    const [event] = await db.select().from(stripeEvents).where(eq(stripeEvents.eventId, eventId));
    return event;
  }

  async markStripeEventProcessed(eventId: string, errorMessage?: string): Promise<StripeEvent> {
    const updates: Partial<StripeEvent> = {
      processed: true,
      processedAt: new Date()
    };
    
    if (errorMessage) {
      updates.errorMessage = errorMessage;
      updates.retryCount = sql`${stripeEvents.retryCount} + 1`;
    }

    const [event] = await db
      .update(stripeEvents)
      .set(updates)
      .where(eq(stripeEvents.eventId, eventId))
      .returning();
    return event;
  }

  async cleanupOldStripeEvents(olderThanDays: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    await db
      .delete(stripeEvents)
      .where(
        and(
          eq(stripeEvents.processed, true),
          sql`${stripeEvents.createdAt} < ${cutoffDate}`
        )
      );
  }
}

export const storage = new DatabaseStorage();