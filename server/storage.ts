import {
  users,
  cvs,
  jobs,
  applications,
  apiUsage,
  templates,
  authAccounts,
  otpCodes,
  paymentRequests,
  savedSearches,
  searchHistory,
  jobBookmarks,
  userPreferences,
  jobAlerts,
  applicationHistory,
  emailEvents,
  applicationDocuments,
  applicationNotifications,
  employerInteractions,
  applicationAnalytics,
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
  type PaymentRequest,
  type InsertPaymentRequest,
  type SavedSearch,
  type InsertSavedSearch,
  type SearchHistory,
  type InsertSearchHistory,
  type JobBookmark,
  type InsertJobBookmark,
  type UserPreferences,
  type InsertUserPreferences,
  type JobAlert,
  type InsertJobAlert,
  type JobSearchFilters,
  type ApplicationHistory,
  type InsertApplicationHistory,
  type EmailEvent,
  type InsertEmailEvent,
  type ApplicationDocument,
  type InsertApplicationDocument,
  type ApplicationNotification,
  type InsertApplicationNotification,
  type EmployerInteraction,
  type InsertEmployerInteraction,
  type ApplicationAnalytics,
  type InsertApplicationAnalytics
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, or, gte, ilike } from "drizzle-orm";

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
  getApplicationsWithJobsByUserId(userId: string): Promise<(Application & { job: Job })[]>;
  updateApplication(id: string, updates: Partial<Application>): Promise<Application>;
  deleteApplication(id: string): Promise<void>;
  getApplicationWithJob(id: string): Promise<(Application & { job: Job }) | undefined>;
  checkExistingApplication(userId: string, jobId: string): Promise<Application | undefined>;
  
  // API Usage operations
  createApiUsage(usage: InsertApiUsage): Promise<ApiUsage>;
  getApiUsageByUserId(userId: string, limit?: number): Promise<ApiUsage[]>;
  getDailyApiUsage(userId: string, date: Date): Promise<ApiUsage[]>;
  getApiUsageSince(since: Date, endpoints?: string[]): Promise<ApiUsage[]>;
  
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

  // User operations
  incrementUserApplicationCount(userId: string): Promise<User>;
  resetMonthlyApplicationCount(userId: string): Promise<User>;
  updateUserPlan(userId: string, plan: string, subscriptionStatus?: string, periodEnd?: Date): Promise<User>;

  // Payment Request operations for payment idempotency (Priority 1)
  getPaymentRequestByKey(idempotencyKey: string): Promise<PaymentRequest | undefined>;
  setPaymentRequestByKey(paymentRequest: InsertPaymentRequest): Promise<PaymentRequest>;
  updatePaymentRequestStatus(id: string, status: string, metadata?: any): Promise<PaymentRequest>;
  cleanupExpiredPaymentRequests(): Promise<void>;

  // Enhanced Job Search operations
  getJobsWithFilters(filters: JobSearchFilters): Promise<Job[]>;
  searchJobsWithAI(query: string, filters: JobSearchFilters, userId?: string): Promise<Job[]>;
  
  // Enhanced Application Tracking operations
  createApplicationHistory(history: InsertApplicationHistory): Promise<ApplicationHistory>;
  getApplicationHistoryByApplicationId(applicationId: string): Promise<ApplicationHistory[]>;
  
  // Email Events operations
  createEmailEvent(event: InsertEmailEvent): Promise<EmailEvent>;
  getEmailEventsByApplication(applicationId: string, eventType?: string, daysBack?: number): Promise<EmailEvent[]>;
  getEmailEventsByUser(userId: string, applicationIds?: string[], dateRange?: { start: Date; end: Date }): Promise<EmailEvent[]>;
  
  // Application Documents operations
  createApplicationDocument(document: InsertApplicationDocument): Promise<ApplicationDocument>;
  getApplicationDocumentsByApplicationId(applicationId: string): Promise<ApplicationDocument[]>;
  updateApplicationDocument(id: string, updates: Partial<ApplicationDocument>): Promise<ApplicationDocument>;
  
  // Application Notifications operations
  createApplicationNotification(notification: InsertApplicationNotification): Promise<ApplicationNotification>;
  getApplicationNotificationsByUserId(userId: string, unreadOnly?: boolean): Promise<ApplicationNotification[]>;
  updateApplicationNotification(id: string, updates: Partial<ApplicationNotification>): Promise<ApplicationNotification>;
  markNotificationAsRead(id: string): Promise<ApplicationNotification>;
  
  // Employer Interactions operations
  createEmployerInteraction(interaction: InsertEmployerInteraction): Promise<EmployerInteraction>;
  getEmployerInteractionsByApplicationId(applicationId: string): Promise<EmployerInteraction[]>;
  
  // Application Analytics operations
  createApplicationAnalytics(analytics: InsertApplicationAnalytics): Promise<ApplicationAnalytics>;
  getApplicationAnalyticsByUserId(userId: string, metric?: string): Promise<ApplicationAnalytics[]>;
  
  // Enhanced search operations for email monitoring
  getApplicationsByEmployerDomain(domain: string): Promise<Application[]>;
  
  // Saved Search operations
  createSavedSearch(savedSearch: InsertSavedSearch): Promise<SavedSearch>;
  getSavedSearchesByUserId(userId: string): Promise<SavedSearch[]>;
  updateSavedSearch(id: string, updates: Partial<SavedSearch>): Promise<SavedSearch>;
  deleteSavedSearch(id: string): Promise<void>;
  
  // Search History operations
  createSearchHistory(searchHistory: InsertSearchHistory): Promise<SearchHistory>;
  getSearchHistoryByUserId(userId: string, limit?: number): Promise<SearchHistory[]>;
  clearSearchHistory(userId: string): Promise<void>;
  
  // Job Bookmark operations
  createJobBookmark(bookmark: InsertJobBookmark): Promise<JobBookmark>;
  getJobBookmarksByUserId(userId: string): Promise<(JobBookmark & { job: Job })[]>;
  deleteJobBookmark(userId: string, jobId: string): Promise<void>;
  isJobBookmarked(userId: string, jobId: string): Promise<boolean>;
  
  // User Preferences operations
  createUserPreferences(preferences: InsertUserPreferences): Promise<UserPreferences>;
  getUserPreferences(userId: string): Promise<UserPreferences | undefined>;
  updateUserPreferences(userId: string, updates: Partial<UserPreferences>): Promise<UserPreferences>;
  
  // Job Alert operations
  createJobAlert(alert: InsertJobAlert): Promise<JobAlert>;
  getJobAlertsByUserId(userId: string): Promise<JobAlert[]>;
  updateJobAlert(id: string, updates: Partial<JobAlert>): Promise<JobAlert>;
  deleteJobAlert(id: string): Promise<void>;
  getActiveJobAlerts(): Promise<JobAlert[]>;
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
    const [cv] = await db.select().from(cvs).where(eq(cvs.userId, userId)).orderBy(desc(cvs.createdAt)).limit(1);
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

  async getApplicationsWithJobsByUserId(userId: string): Promise<(Application & { job: Job })[]> {
    const results = await db.select()
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .where(eq(applications.userId, userId))
      .orderBy(desc(applications.appliedDate));
    
    return results.map(result => ({
      ...result.applications,
      job: result.jobs
    }));
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

  async getApiUsageSince(since: Date, endpoints?: string[]): Promise<ApiUsage[]> {
    const whereConditions = [gte(apiUsage.createdAt, since)];
    
    if (endpoints && endpoints.length > 0) {
      const endpointConditions = endpoints.map(endpoint => 
        ilike(apiUsage.endpoint, `%${endpoint}%`)
      );
      whereConditions.push(or(...endpointConditions));
    }
    
    return await db
      .select()
      .from(apiUsage)
      .where(and(...whereConditions))
      .orderBy(desc(apiUsage.createdAt));
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


  // Payment Request operations for payment idempotency (Priority 1)
  async getPaymentRequestByKey(idempotencyKey: string): Promise<PaymentRequest | undefined> {
    const [paymentRequest] = await db
      .select()
      .from(paymentRequests)
      .where(eq(paymentRequests.idempotencyKey, idempotencyKey));
    return paymentRequest;
  }

  async setPaymentRequestByKey(paymentRequestData: InsertPaymentRequest): Promise<PaymentRequest> {
    const [paymentRequest] = await db.insert(paymentRequests).values(paymentRequestData).returning();
    return paymentRequest;
  }

  async updatePaymentRequestStatus(id: string, status: string, metadata?: any): Promise<PaymentRequest> {
    const [paymentRequest] = await db
      .update(paymentRequests)
      .set({ 
        status, 
        metadata,
        updatedAt: new Date() 
      })
      .where(eq(paymentRequests.id, id))
      .returning();
    return paymentRequest;
  }

  async cleanupExpiredPaymentRequests(): Promise<void> {
    const now = new Date();
    await db.delete(paymentRequests)
      .where(sql`${paymentRequests.expiresAt} < ${now}`);
  }

  // Enhanced Job Search operations
  async getJobsWithFilters(filters: JobSearchFilters): Promise<Job[]> {
    let query = db.select().from(jobs).where(eq(jobs.isActive, true));
    
    const conditions = [];
    
    if (filters.location) {
      conditions.push(ilike(jobs.location, `%${filters.location}%`));
    }
    
    if (filters.type) {
      conditions.push(ilike(jobs.type, `%${filters.type}%`));
    }
    
    if (filters.company) {
      conditions.push(ilike(jobs.company, `%${filters.company}%`));
    }
    
    if (filters.postedWithin) {
      const daysMap = {
        '1day': 1,
        '3days': 3,
        '1week': 7,
        '2weeks': 14,
        '1month': 30
      };
      const days = daysMap[filters.postedWithin];
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      conditions.push(gte(jobs.postedDate, cutoffDate));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    // Apply sorting
    if (filters.sortBy === 'date') {
      query = query.orderBy(filters.sortOrder === 'asc' ? jobs.postedDate : desc(jobs.postedDate)) as any;
    } else {
      query = query.orderBy(desc(jobs.postedDate)) as any;
    }
    
    // Apply pagination
    if (filters.limit) {
      query = query.limit(filters.limit) as any;
    }
    
    if (filters.offset) {
      query = query.offset(filters.offset) as any;
    }
    
    return await query;
  }
  
  async searchJobsWithAI(query: string, filters: JobSearchFilters, userId?: string): Promise<Job[]> {
    // For now, fallback to regular search with text matching
    const conditions = [eq(jobs.isActive, true)];
    
    if (query) {
      conditions.push(or(
        ilike(jobs.title, `%${query}%`),
        ilike(jobs.description, `%${query}%`),
        ilike(jobs.company, `%${query}%`)
      ));
    }
    
    // Apply additional filters
    if (filters.location) {
      conditions.push(ilike(jobs.location, `%${filters.location}%`));
    }
    
    if (filters.type) {
      conditions.push(ilike(jobs.type, `%${filters.type}%`));
    }
    
    const result = await db.select()
      .from(jobs)
      .where(and(...conditions))
      .orderBy(desc(jobs.postedDate))
      .limit(filters.limit || 20);
      
    return result;
  }

  // Saved Search operations
  async createSavedSearch(savedSearchData: InsertSavedSearch): Promise<SavedSearch> {
    const [savedSearch] = await db.insert(savedSearches).values(savedSearchData).returning();
    return savedSearch;
  }

  async getSavedSearchesByUserId(userId: string): Promise<SavedSearch[]> {
    return await db.select()
      .from(savedSearches)
      .where(eq(savedSearches.userId, userId))
      .orderBy(desc(savedSearches.updatedAt));
  }

  async updateSavedSearch(id: string, updates: Partial<SavedSearch>): Promise<SavedSearch> {
    const [savedSearch] = await db
      .update(savedSearches)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(savedSearches.id, id))
      .returning();
    return savedSearch;
  }

  async deleteSavedSearch(id: string): Promise<void> {
    await db.delete(savedSearches).where(eq(savedSearches.id, id));
  }

  // Search History operations
  async createSearchHistory(searchHistoryData: InsertSearchHistory): Promise<SearchHistory> {
    const [searchHistoryItem] = await db.insert(searchHistory).values(searchHistoryData).returning();
    return searchHistoryItem;
  }

  async getSearchHistoryByUserId(userId: string, limit: number = 10): Promise<SearchHistory[]> {
    return await db.select()
      .from(searchHistory)
      .where(eq(searchHistory.userId, userId))
      .orderBy(desc(searchHistory.createdAt))
      .limit(limit);
  }

  async clearSearchHistory(userId: string): Promise<void> {
    await db.delete(searchHistory).where(eq(searchHistory.userId, userId));
  }

  // Job Bookmark operations
  async createJobBookmark(bookmarkData: InsertJobBookmark): Promise<JobBookmark> {
    const [bookmark] = await db.insert(jobBookmarks).values(bookmarkData).returning();
    return bookmark;
  }

  async getJobBookmarksByUserId(userId: string): Promise<(JobBookmark & { job: Job })[]> {
    const results = await db.select()
      .from(jobBookmarks)
      .innerJoin(jobs, eq(jobBookmarks.jobId, jobs.id))
      .where(eq(jobBookmarks.userId, userId))
      .orderBy(desc(jobBookmarks.createdAt));
    
    return results.map(result => ({
      ...result.job_bookmarks,
      job: result.jobs
    }));
  }

  async deleteJobBookmark(userId: string, jobId: string): Promise<void> {
    await db.delete(jobBookmarks)
      .where(and(
        eq(jobBookmarks.userId, userId),
        eq(jobBookmarks.jobId, jobId)
      ));
  }

  async isJobBookmarked(userId: string, jobId: string): Promise<boolean> {
    const [bookmark] = await db.select()
      .from(jobBookmarks)
      .where(and(
        eq(jobBookmarks.userId, userId),
        eq(jobBookmarks.jobId, jobId)
      ))
      .limit(1);
    
    return !!bookmark;
  }

  // User Preferences operations
  async createUserPreferences(preferencesData: InsertUserPreferences): Promise<UserPreferences> {
    const [preferences] = await db.insert(userPreferences).values(preferencesData).returning();
    return preferences;
  }

  async getUserPreferences(userId: string): Promise<UserPreferences | undefined> {
    const [preferences] = await db.select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId));
    return preferences;
  }

  async updateUserPreferences(userId: string, updates: Partial<UserPreferences>): Promise<UserPreferences> {
    const [preferences] = await db
      .update(userPreferences)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(userPreferences.userId, userId))
      .returning();
    return preferences;
  }

  // Job Alert operations
  async createJobAlert(alertData: InsertJobAlert): Promise<JobAlert> {
    const [alert] = await db.insert(jobAlerts).values(alertData).returning();
    return alert;
  }

  async getJobAlertsByUserId(userId: string): Promise<JobAlert[]> {
    return await db.select()
      .from(jobAlerts)
      .where(eq(jobAlerts.userId, userId))
      .orderBy(desc(jobAlerts.createdAt));
  }

  async updateJobAlert(id: string, updates: Partial<JobAlert>): Promise<JobAlert> {
    const [alert] = await db
      .update(jobAlerts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(jobAlerts.id, id))
      .returning();
    return alert;
  }

  async deleteJobAlert(id: string): Promise<void> {
    await db.delete(jobAlerts).where(eq(jobAlerts.id, id));
  }

  async getActiveJobAlerts(): Promise<JobAlert[]> {
    return await db.select()
      .from(jobAlerts)
      .where(eq(jobAlerts.isActive, true))
      .orderBy(jobAlerts.nextScheduled);
  }

  // Enhanced Application Tracking operations
  async createApplicationHistory(history: InsertApplicationHistory): Promise<ApplicationHistory> {
    const [created] = await db.insert(applicationHistory)
      .values(history)
      .returning();
    return created;
  }

  async getApplicationHistoryByApplicationId(applicationId: string): Promise<ApplicationHistory[]> {
    return await db.select()
      .from(applicationHistory)
      .where(eq(applicationHistory.applicationId, applicationId))
      .orderBy(desc(applicationHistory.createdAt));
  }

  // Email Events operations
  async createEmailEvent(event: InsertEmailEvent): Promise<EmailEvent> {
    const [created] = await db.insert(emailEvents)
      .values(event)
      .returning();
    return created;
  }

  async getEmailEventsByApplication(
    applicationId: string, 
    eventType?: string, 
    daysBack?: number
  ): Promise<EmailEvent[]> {
    let query = db.select()
      .from(emailEvents)
      .where(eq(emailEvents.applicationId, applicationId));

    if (eventType) {
      query = query.where(and(
        eq(emailEvents.applicationId, applicationId),
        eq(emailEvents.eventType, eventType)
      ));
    }

    if (daysBack) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);
      query = query.where(and(
        eq(emailEvents.applicationId, applicationId),
        gte(emailEvents.timestamp, cutoffDate),
        eventType ? eq(emailEvents.eventType, eventType) : sql`true`
      ));
    }

    return await query.orderBy(desc(emailEvents.timestamp));
  }

  async getEmailEventsByUser(
    userId: string, 
    applicationIds?: string[], 
    dateRange?: { start: Date; end: Date }
  ): Promise<EmailEvent[]> {
    let query = db.select()
      .from(emailEvents)
      .where(eq(emailEvents.userId, userId));

    if (applicationIds && applicationIds.length > 0) {
      query = query.where(and(
        eq(emailEvents.userId, userId),
        sql`${emailEvents.applicationId} = ANY(${applicationIds})`
      ));
    }

    if (dateRange) {
      query = query.where(and(
        eq(emailEvents.userId, userId),
        gte(emailEvents.timestamp, dateRange.start),
        sql`${emailEvents.timestamp} <= ${dateRange.end}`
      ));
    }

    return await query.orderBy(desc(emailEvents.timestamp));
  }

  // Application Documents operations
  async createApplicationDocument(document: InsertApplicationDocument): Promise<ApplicationDocument> {
    const [created] = await db.insert(applicationDocuments)
      .values(document)
      .returning();
    return created;
  }

  async getApplicationDocumentsByApplicationId(applicationId: string): Promise<ApplicationDocument[]> {
    return await db.select()
      .from(applicationDocuments)
      .where(and(
        eq(applicationDocuments.applicationId, applicationId),
        eq(applicationDocuments.isActive, true)
      ))
      .orderBy(desc(applicationDocuments.createdAt));
  }

  async updateApplicationDocument(id: string, updates: Partial<ApplicationDocument>): Promise<ApplicationDocument> {
    const [updated] = await db.update(applicationDocuments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(applicationDocuments.id, id))
      .returning();
    return updated;
  }

  // Application Notifications operations
  async createApplicationNotification(notification: InsertApplicationNotification): Promise<ApplicationNotification> {
    const [created] = await db.insert(applicationNotifications)
      .values(notification)
      .returning();
    return created;
  }

  async getApplicationNotificationsByUserId(
    userId: string, 
    unreadOnly?: boolean
  ): Promise<ApplicationNotification[]> {
    let query = db.select()
      .from(applicationNotifications)
      .where(and(
        eq(applicationNotifications.userId, userId),
        eq(applicationNotifications.isActive, true)
      ));

    if (unreadOnly) {
      query = query.where(and(
        eq(applicationNotifications.userId, userId),
        eq(applicationNotifications.isActive, true),
        eq(applicationNotifications.isRead, false)
      ));
    }

    return await query.orderBy(desc(applicationNotifications.scheduledFor));
  }

  async updateApplicationNotification(id: string, updates: Partial<ApplicationNotification>): Promise<ApplicationNotification> {
    const [updated] = await db.update(applicationNotifications)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(applicationNotifications.id, id))
      .returning();
    return updated;
  }

  async markNotificationAsRead(id: string): Promise<ApplicationNotification> {
    const [updated] = await db.update(applicationNotifications)
      .set({ isRead: true, updatedAt: new Date() })
      .where(eq(applicationNotifications.id, id))
      .returning();
    return updated;
  }

  // Employer Interactions operations
  async createEmployerInteraction(interaction: InsertEmployerInteraction): Promise<EmployerInteraction> {
    const [created] = await db.insert(employerInteractions)
      .values(interaction)
      .returning();
    return created;
  }

  async getEmployerInteractionsByApplicationId(applicationId: string): Promise<EmployerInteraction[]> {
    return await db.select()
      .from(employerInteractions)
      .where(eq(employerInteractions.applicationId, applicationId))
      .orderBy(desc(employerInteractions.timestamp));
  }

  // Application Analytics operations
  async createApplicationAnalytics(analytics: InsertApplicationAnalytics): Promise<ApplicationAnalytics> {
    const [created] = await db.insert(applicationAnalytics)
      .values(analytics)
      .returning();
    return created;
  }

  async getApplicationAnalyticsByUserId(
    userId: string, 
    metric?: string
  ): Promise<ApplicationAnalytics[]> {
    let query = db.select()
      .from(applicationAnalytics)
      .where(eq(applicationAnalytics.userId, userId));

    if (metric) {
      query = query.where(and(
        eq(applicationAnalytics.userId, userId),
        eq(applicationAnalytics.metric, metric)
      ));
    }

    return await query.orderBy(desc(applicationAnalytics.calculatedAt));
  }

  // Enhanced search operations for email monitoring
  async getApplicationsByEmployerDomain(domain: string): Promise<Application[]> {
    // Join with jobs table to search by company domain
    return await db.select({
      id: applications.id,
      userId: applications.userId,
      jobId: applications.jobId,
      status: applications.status,
      matchScore: applications.matchScore,
      tailoredCv: applications.tailoredCv,
      coverLetter: applications.coverLetter,
      preparationStatus: applications.preparationStatus,
      preparationMetadata: applications.preparationMetadata,
      emailSentAt: applications.emailSentAt,
      emailOpened: applications.emailOpened,
      emailOpenedAt: applications.emailOpenedAt,
      emailRepliedAt: applications.emailRepliedAt,
      lastEmailInteractionAt: applications.lastEmailInteractionAt,
      appliedDate: applications.appliedDate,
      viewedByEmployerAt: applications.viewedByEmployerAt,
      interviewScheduledAt: applications.interviewScheduledAt,
      interviewDate: applications.interviewDate,
      interviewCompletedAt: applications.interviewCompletedAt,
      offerReceivedAt: applications.offerReceivedAt,
      rejectedAt: applications.rejectedAt,
      withdrawnAt: applications.withdrawnAt,
      lastStatusChangeAt: applications.lastStatusChangeAt,
      nextFollowUpDate: applications.nextFollowUpDate,
      followUpReminderSent: applications.followUpReminderSent,
      autoFollowUpEnabled: applications.autoFollowUpEnabled,
      employerProfileViews: applications.employerProfileViews,
      applicationDownloads: applications.applicationDownloads,
      employerInteractionScore: applications.employerInteractionScore,
      applicationSource: applications.applicationSource,
      priority: applications.priority,
      notes: applications.notes,
      internalNotes: applications.internalNotes,
      tags: applications.tags,
      createdAt: applications.createdAt,
      updatedAt: applications.updatedAt,
      job: {
        id: jobs.id,
        title: jobs.title,
        company: jobs.company,
        location: jobs.location,
        type: jobs.type,
        salary: jobs.salary,
        description: jobs.description,
        requirements: jobs.requirements,
        postedDate: jobs.postedDate,
        isActive: jobs.isActive,
        createdAt: jobs.createdAt
      }
    })
    .from(applications)
    .innerJoin(jobs, eq(applications.jobId, jobs.id))
    .where(ilike(jobs.company, `%${domain}%`))
    .orderBy(desc(applications.appliedDate));
  }
}

export const storage = new DatabaseStorage();