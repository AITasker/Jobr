import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  unique
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Users table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  plan: varchar("plan").default("Free").notNull(), // Free, Premium
  subscriptionStatus: varchar("subscription_status").default("active"), // active, canceled, past_due, incomplete
  subscriptionCurrentPeriodEnd: timestamp("subscription_current_period_end"),
  cvDownloadsThisMonth: integer("cv_downloads_this_month").default(0).notNull(),
  monthlyDownloadsReset: timestamp("monthly_downloads_reset").defaultNow(),
  cvDownloadsRemaining: integer("cv_downloads_remaining").default(2).notNull(), // Free tier gets 2 CV downloads
  apiCallsToday: integer("api_calls_today").default(0).notNull(),
  lastApiCallReset: timestamp("last_api_call_reset").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});


// CV data table
export const cvs = pgTable("cvs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  originalContent: text("original_content"), // Store original CV text
  parsedData: jsonb("parsed_data"), // Structured data extracted by AI
  skills: text("skills").array(),
  experience: text("experience"),
  education: text("education"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_cvs_user_created_at").on(table.userId, table.createdAt.desc()),
]);

// Job listings table
export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  company: text("company").notNull(),
  location: text("location").notNull(),
  type: varchar("type").notNull(), // Full-time, Contract, etc.
  salary: text("salary"),
  description: text("description").notNull(),
  requirements: text("requirements").array(),
  postedDate: timestamp("posted_date").defaultNow(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_jobs_active_posted_date").on(table.postedDate.desc()).where(sql`${table.isActive} = true`),
]);

// Job applications table
export const applications = pgTable("applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  status: varchar("status").default("applied").notNull(), // applied, viewed, interview_scheduled, interviewing, interview_completed, offered, rejected, withdrawn
  matchScore: integer("match_score").notNull(),
  tailoredCv: text("tailored_cv"),
  coverLetter: text("cover_letter"),
  preparationStatus: varchar("preparation_status").default("pending").notNull(), // pending, preparing, ready, failed
  preparationMetadata: jsonb("preparation_metadata"), // AI generation details, fallback used, etc.
  
  // Enhanced email tracking
  emailSentAt: timestamp("email_sent_at"),
  emailOpened: boolean("email_opened").default(false),
  emailOpenedAt: timestamp("email_opened_at"),
  emailRepliedAt: timestamp("email_replied_at"),
  lastEmailInteractionAt: timestamp("last_email_interaction_at"),
  
  // Application timeline and dates
  appliedDate: timestamp("applied_date").defaultNow(),
  viewedByEmployerAt: timestamp("viewed_by_employer_at"),
  interviewScheduledAt: timestamp("interview_scheduled_at"),
  interviewDate: timestamp("interview_date"),
  interviewCompletedAt: timestamp("interview_completed_at"),
  offerReceivedAt: timestamp("offer_received_at"),
  rejectedAt: timestamp("rejected_at"),
  withdrawnAt: timestamp("withdrawn_at"),
  lastStatusChangeAt: timestamp("last_status_change_at").defaultNow(),
  
  // Follow-up and reminders
  nextFollowUpDate: timestamp("next_follow_up_date"),
  followUpReminderSent: boolean("follow_up_reminder_sent").default(false),
  autoFollowUpEnabled: boolean("auto_follow_up_enabled").default(true),
  
  // Employer interaction tracking
  employerProfileViews: integer("employer_profile_views").default(0),
  applicationDownloads: integer("application_downloads").default(0),
  employerInteractionScore: integer("employer_interaction_score").default(0),
  
  // Enhanced metadata
  applicationSource: varchar("application_source").default("career_copilot"), // career_copilot, manual, imported
  priority: varchar("priority").default("medium"), // low, medium, high, urgent
  notes: text("notes"),
  internalNotes: text("internal_notes"), // Private notes not shown to employer
  tags: text("tags").array(), // User-defined tags for categorization
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueUserJob: unique("unique_user_job").on(table.userId, table.jobId),
  idxApplicationsUserAppliedDate: index("idx_applications_user_applied_date").on(table.userId, table.appliedDate.desc()),
  idxApplicationsStatus: index("idx_applications_status").on(table.status),
  idxApplicationsFollowUp: index("idx_applications_follow_up").on(table.nextFollowUpDate),
  idxApplicationsLastStatusChange: index("idx_applications_last_status_change").on(table.lastStatusChangeAt.desc()),
  idxApplicationsPriority: index("idx_applications_priority").on(table.priority),
}));

// Application timeline/history table for tracking status changes and milestones
export const applicationHistory = pgTable("application_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  previousStatus: varchar("previous_status"),
  newStatus: varchar("new_status").notNull(),
  changeReason: varchar("change_reason"), // user_update, email_response, employer_action, system_auto
  metadata: jsonb("metadata"), // Additional context like interview details, rejection reason, etc.
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_application_history_application_id").on(table.applicationId),
  index("idx_application_history_user_created").on(table.userId, table.createdAt.desc()),
  index("idx_application_history_status").on(table.newStatus),
]);

// Email tracking events for comprehensive email monitoring
export const emailEvents = pgTable("email_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  eventType: varchar("event_type").notNull(), // sent, delivered, opened, clicked, replied, bounced, spam
  emailType: varchar("email_type").notNull(), // application_sent, follow_up, interview_request, status_update
  sendgridMessageId: varchar("sendgrid_message_id"),
  recipientEmail: varchar("recipient_email"),
  subject: text("subject"),
  metadata: jsonb("metadata"), // Email content, tracking data, response details
  timestamp: timestamp("timestamp").defaultNow(),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_email_events_application_id").on(table.applicationId),
  index("idx_email_events_user_timestamp").on(table.userId, table.timestamp.desc()),
  index("idx_email_events_type").on(table.eventType),
  index("idx_email_events_sendgrid_id").on(table.sendgridMessageId),
]);

// Application documents for version control and document management
export const applicationDocuments = pgTable("application_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  documentType: varchar("document_type").notNull(), // cv, cover_letter, portfolio, transcript, certification
  fileName: text("file_name").notNull(),
  originalFileName: text("original_file_name"),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type"),
  storageUrl: text("storage_url"), // URL to stored document
  content: text("content"), // Document text content for searching
  version: integer("version").default(1).notNull(),
  isActive: boolean("is_active").default(true),
  generatedBy: varchar("generated_by"), // ai, user, imported
  generationMetadata: jsonb("generation_metadata"), // AI prompts, settings used
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_application_documents_application_id").on(table.applicationId),
  index("idx_application_documents_user_id").on(table.userId),
  index("idx_application_documents_type").on(table.documentType),
  index("idx_application_documents_active").on(table.isActive),
]);

// Application notifications and reminders
export const applicationNotifications = pgTable("application_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  notificationType: varchar("notification_type").notNull(), // follow_up_reminder, interview_reminder, status_change, deadline_warning
  title: text("title").notNull(),
  message: text("message").notNull(),
  scheduledFor: timestamp("scheduled_for").notNull(),
  sentAt: timestamp("sent_at"),
  isRead: boolean("is_read").default(false),
  isActive: boolean("is_active").default(true),
  notificationMethod: text("notification_method").array().default(['in_app']), // in_app, email, push
  metadata: jsonb("metadata"), // Additional context for the notification
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_application_notifications_application_id").on(table.applicationId),
  index("idx_application_notifications_user_scheduled").on(table.userId, table.scheduledFor),
  index("idx_application_notifications_type").on(table.notificationType),
  index("idx_application_notifications_unread").on(table.isRead, table.isActive),
]);

// Employer interactions tracking
export const employerInteractions = pgTable("employer_interactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  interactionType: varchar("interaction_type").notNull(), // profile_view, application_download, email_open, response_received
  interactionSource: varchar("interaction_source"), // email_tracker, linkedin, company_portal, direct
  employerEmail: varchar("employer_email"),
  employerName: varchar("employer_name"),
  interactionData: jsonb("interaction_data"), // Additional details about the interaction
  timestamp: timestamp("timestamp").defaultNow(),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  location: jsonb("location"), // Geographic data if available
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_employer_interactions_application_id").on(table.applicationId),
  index("idx_employer_interactions_user_timestamp").on(table.userId, table.timestamp.desc()),
  index("idx_employer_interactions_type").on(table.interactionType),
  index("idx_employer_interactions_employer").on(table.employerEmail),
]);

// Application analytics and insights
export const applicationAnalytics = pgTable("application_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  applicationId: varchar("application_id").references(() => applications.id, { onDelete: "cascade" }),
  metric: varchar("metric").notNull(), // response_rate, time_to_response, success_rate, etc.
  value: decimal("value").notNull(),
  metadata: jsonb("metadata"), // Additional context for the metric
  calculatedAt: timestamp("calculated_at").defaultNow(),
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_application_analytics_user_metric").on(table.userId, table.metric),
  index("idx_application_analytics_application_id").on(table.applicationId),
  index("idx_application_analytics_calculated_at").on(table.calculatedAt.desc()),
]);

// API usage tracking table for detailed analytics
export const apiUsage = pgTable("api_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  endpoint: varchar("endpoint").notNull(), // cover_letter, cv_tailor, etc.
  tokensUsed: integer("tokens_used").default(0),
  success: boolean("success").default(true),
  errorMessage: text("error_message"),
  responseTime: integer("response_time_ms"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Application preparation templates for fallback
export const templates = pgTable("templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: varchar("type").notNull(), // cover_letter, cv_summary
  name: varchar("name").notNull(),
  template: text("template").notNull(),
  variables: text("variables").array(), // ["name", "company", "position"]
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Authentication accounts table for multi-provider auth
export const authAccounts = pgTable("auth_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: varchar("provider").notNull(), // 'email', 'replit', 'google', etc.
  providerUserId: varchar("provider_user_id"), // External provider's user ID
  email: varchar("email"),
  phone: varchar("phone"),
  passwordHash: varchar("password_hash"), // For email/password auth
  verified: boolean("verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_auth_accounts_user_id").on(table.userId),
  index("idx_auth_accounts_provider").on(table.provider),
  index("idx_auth_accounts_email").on(table.email),
  unique("unique_provider_account").on(table.provider, table.providerUserId),
  unique("unique_email_provider").on(table.email, table.provider),
]);

// OTP codes table for verification
export const otpCodes = pgTable("otp_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  target: varchar("target").notNull(), // email or phone number
  sentTo: varchar("sent_to").notNull(), // normalized email/phone
  codeHash: varchar("code_hash").notNull(), // hashed OTP code
  purpose: varchar("purpose").notNull(), // 'email_verification', 'password_reset', 'login'
  expiresAt: timestamp("expires_at").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_otp_codes_target").on(table.target),
  index("idx_otp_codes_expires_at").on(table.expiresAt),
]);


// UPI payments table for simple payment tracking
export const upiPayments = pgTable("upi_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(), // Amount in rupees (₹999)
  status: varchar("status").default("pending").notNull(), // pending, completed, failed
  paymentReference: varchar("payment_reference"), // User can enter UPI reference number
  notes: text("notes"), // User notes about payment
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_upi_payments_user_id").on(table.userId),
  index("idx_upi_payments_status").on(table.status),
]);

// Saved searches table for storing user search queries and filters
export const savedSearches = pgTable("saved_searches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name").notNull(), // User-defined name for the search
  query: text("query"), // Search query text
  filters: jsonb("filters"), // JSON object with location, type, salary, etc.
  isDefault: boolean("is_default").default(false),
  alertEnabled: boolean("alert_enabled").default(false), // Whether to send alerts for this search
  lastAlertSent: timestamp("last_alert_sent"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_saved_searches_user_id").on(table.userId),
  index("idx_saved_searches_alert_enabled").on(table.alertEnabled),
]);

// Search history table for storing recent searches
export const searchHistory = pgTable("search_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  query: text("query"), // Search query text
  filters: jsonb("filters"), // JSON object with applied filters
  resultsCount: integer("results_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_search_history_user_id").on(table.userId),
  index("idx_search_history_created_at").on(table.createdAt.desc()),
]);

// Job bookmarks/favorites table
export const jobBookmarks = pgTable("job_bookmarks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  notes: text("notes"), // User notes about this job
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique("unique_user_job_bookmark").on(table.userId, table.jobId),
  index("idx_job_bookmarks_user_id").on(table.userId),
]);

// User preferences table for personalized recommendations
export const userPreferences = pgTable("user_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  preferredLocations: text("preferred_locations").array(),
  preferredJobTypes: text("preferred_job_types").array(),
  salaryRange: jsonb("salary_range"), // {min: number, max: number, currency: string}
  workArrangement: varchar("work_arrangement"), // remote, hybrid, onsite, flexible
  experienceLevel: varchar("experience_level"), // entry, mid, senior, executive
  industries: text("industries").array(),
  companySize: varchar("company_size"), // startup, small, medium, large, enterprise
  benefits: text("benefits").array(), // health_insurance, flexible_hours, etc.
  preferences: jsonb("preferences"), // Notification and application preferences as JSON
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("unique_user_preferences").on(table.userId),
  index("idx_user_preferences_user_id").on(table.userId),
]);

// Job alerts table for notification management
export const jobAlerts = pgTable("job_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  savedSearchId: varchar("saved_search_id").references(() => savedSearches.id, { onDelete: "cascade" }),
  frequency: varchar("frequency").default("daily").notNull(), // daily, weekly, immediate
  isActive: boolean("is_active").default(true),
  lastSent: timestamp("last_sent"),
  nextScheduled: timestamp("next_scheduled"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_job_alerts_user_id").on(table.userId),
  index("idx_job_alerts_next_scheduled").on(table.nextScheduled),
]);

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  cvs: many(cvs),
  applications: many(applications),
  applicationHistory: many(applicationHistory),
  emailEvents: many(emailEvents),
  applicationDocuments: many(applicationDocuments),
  applicationNotifications: many(applicationNotifications),
  employerInteractions: many(employerInteractions),
  applicationAnalytics: many(applicationAnalytics),
  apiUsage: many(apiUsage),
  authAccounts: many(authAccounts),
  upiPayments: many(upiPayments),
  savedSearches: many(savedSearches),
  searchHistory: many(searchHistory),
  jobBookmarks: many(jobBookmarks),
  preferences: one(userPreferences),
  jobAlerts: many(jobAlerts),
}));

export const upiPaymentsRelations = relations(upiPayments, ({ one }) => ({
  user: one(users, {
    fields: [upiPayments.userId],
    references: [users.id],
  }),
}));


export const authAccountsRelations = relations(authAccounts, ({ one }) => ({
  user: one(users, {
    fields: [authAccounts.userId],
    references: [users.id],
  }),
}));

export const cvsRelations = relations(cvs, ({ one }) => ({
  user: one(users, {
    fields: [cvs.userId],
    references: [users.id],
  }),
}));

export const jobsRelations = relations(jobs, ({ many }) => ({
  applications: many(applications),
}));

export const applicationsRelations = relations(applications, ({ one, many }) => ({
  user: one(users, {
    fields: [applications.userId],
    references: [users.id],
  }),
  job: one(jobs, {
    fields: [applications.jobId],
    references: [jobs.id],
  }),
  history: many(applicationHistory),
  emailEvents: many(emailEvents),
  documents: many(applicationDocuments),
  notifications: many(applicationNotifications),
  employerInteractions: many(employerInteractions),
  analytics: many(applicationAnalytics),
}));

export const apiUsageRelations = relations(apiUsage, ({ one }) => ({
  user: one(users, {
    fields: [apiUsage.userId],
    references: [users.id],
  }),
}));

export const savedSearchesRelations = relations(savedSearches, ({ one, many }) => ({
  user: one(users, {
    fields: [savedSearches.userId],
    references: [users.id],
  }),
  jobAlerts: many(jobAlerts),
}));

export const searchHistoryRelations = relations(searchHistory, ({ one }) => ({
  user: one(users, {
    fields: [searchHistory.userId],
    references: [users.id],
  }),
}));

export const jobBookmarksRelations = relations(jobBookmarks, ({ one }) => ({
  user: one(users, {
    fields: [jobBookmarks.userId],
    references: [users.id],
  }),
  job: one(jobs, {
    fields: [jobBookmarks.jobId],
    references: [jobs.id],
  }),
}));

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userPreferences.userId],
    references: [users.id],
  }),
}));

export const jobAlertsRelations = relations(jobAlerts, ({ one }) => ({
  user: one(users, {
    fields: [jobAlerts.userId],
    references: [users.id],
  }),
  savedSearch: one(savedSearches, {
    fields: [jobAlerts.savedSearchId],
    references: [savedSearches.id],
  }),
}));

// New table relations
export const applicationHistoryRelations = relations(applicationHistory, ({ one }) => ({
  application: one(applications, {
    fields: [applicationHistory.applicationId],
    references: [applications.id],
  }),
  user: one(users, {
    fields: [applicationHistory.userId],
    references: [users.id],
  }),
}));

export const emailEventsRelations = relations(emailEvents, ({ one }) => ({
  application: one(applications, {
    fields: [emailEvents.applicationId],
    references: [applications.id],
  }),
  user: one(users, {
    fields: [emailEvents.userId],
    references: [users.id],
  }),
}));

export const applicationDocumentsRelations = relations(applicationDocuments, ({ one }) => ({
  application: one(applications, {
    fields: [applicationDocuments.applicationId],
    references: [applications.id],
  }),
  user: one(users, {
    fields: [applicationDocuments.userId],
    references: [users.id],
  }),
}));

export const applicationNotificationsRelations = relations(applicationNotifications, ({ one }) => ({
  application: one(applications, {
    fields: [applicationNotifications.applicationId],
    references: [applications.id],
  }),
  user: one(users, {
    fields: [applicationNotifications.userId],
    references: [users.id],
  }),
}));

export const employerInteractionsRelations = relations(employerInteractions, ({ one }) => ({
  application: one(applications, {
    fields: [employerInteractions.applicationId],
    references: [applications.id],
  }),
  user: one(users, {
    fields: [employerInteractions.userId],
    references: [users.id],
  }),
}));

export const applicationAnalyticsRelations = relations(applicationAnalytics, ({ one }) => ({
  application: one(applications, {
    fields: [applicationAnalytics.applicationId],
    references: [applications.id],
  }),
  user: one(users, {
    fields: [applicationAnalytics.userId],
    references: [users.id],
  }),
}));

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users);
export const insertCvSchema = createInsertSchema(cvs).omit({ id: true, createdAt: true, updatedAt: true });
export const insertJobSchema = createInsertSchema(jobs).omit({ id: true, createdAt: true });
export const insertApplicationSchema = createInsertSchema(applications).omit({ id: true, createdAt: true, updatedAt: true });
export const insertApiUsageSchema = createInsertSchema(apiUsage).omit({ id: true, createdAt: true });
export const insertTemplateSchema = createInsertSchema(templates).omit({ id: true, createdAt: true });
export const insertAuthAccountSchema = createInsertSchema(authAccounts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOtpCodeSchema = createInsertSchema(otpCodes).omit({ id: true, createdAt: true });
export const insertUpiPaymentSchema = createInsertSchema(upiPayments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSavedSearchSchema = createInsertSchema(savedSearches).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSearchHistorySchema = createInsertSchema(searchHistory).omit({ id: true, createdAt: true });
export const insertJobBookmarkSchema = createInsertSchema(jobBookmarks).omit({ id: true, createdAt: true });
export const insertUserPreferencesSchema = createInsertSchema(userPreferences).omit({ id: true, createdAt: true, updatedAt: true });
export const insertJobAlertSchema = createInsertSchema(jobAlerts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertApplicationHistorySchema = createInsertSchema(applicationHistory).omit({ id: true, createdAt: true });
export const insertEmailEventSchema = createInsertSchema(emailEvents).omit({ id: true, createdAt: true });
export const insertApplicationDocumentSchema = createInsertSchema(applicationDocuments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertApplicationNotificationSchema = createInsertSchema(applicationNotifications).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEmployerInteractionSchema = createInsertSchema(employerInteractions).omit({ id: true, createdAt: true });
export const insertApplicationAnalyticsSchema = createInsertSchema(applicationAnalytics).omit({ id: true, createdAt: true });

// Additional auth-specific schemas
export const registerSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(100, "Password too long"),
  firstName: z.string().min(1, "First name is required").max(50, "First name too long"),
  lastName: z.string().min(1, "Last name is required").max(50, "Last name too long"),
});

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

// Subscription-specific schemas
export const planSchema = z.enum(["Free", "Premium", "Pro"]);

// Server-side price validation schema with allowlisted plan->priceId mappings
export const createSubscriptionSchema = z.object({
  plan: planSchema,
});

// Valid price mappings for PhonePe (in paise - 1 rupee = 100 paise)
export const VALID_PRICE_MAPPINGS: Record<string, number> = {
  "Premium": 49900, // ₹499
  "Pro": 99900,     // ₹999
};

// Webhook event validation schema
export const webhookEventIdempotencySchema = z.object({
  eventId: z.string().min(1),
  eventType: z.string().min(1),
  processed: z.boolean().default(false),
  processedAt: z.date().optional(),
});

export const updateSubscriptionSchema = z.object({
  plan: planSchema.optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
});

// Phone authentication schemas (Priority 3: Phone Auth Validation)
export const phoneRequestSchema = z.object({
  phoneNumber: z.string()
    .regex(/^\+[1-9]\d{1,14}$/, "Invalid international phone number format")
    .min(10, "Phone number too short")
    .max(15, "Phone number too long")
});

export const phoneVerifySchema = z.object({
  phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/),
  otpCode: z.string().length(6, "OTP code must be 6 digits").regex(/^\d{6}$/),
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional()
});

// Job application schemas
export const jobApplySchema = z.object({
  jobId: z.string().uuid("Invalid job ID"),
  notes: z.string().max(1000).optional()
});

export const cvTailorSchema = z.object({
  jobId: z.string().uuid("Invalid job ID")
});

export const applicationUpdateSchema = z.object({
  status: z.enum(["applied", "viewed", "interviewing", "offered", "rejected"]).optional(),
  notes: z.string().max(1000).optional(),
  interviewDate: z.string().datetime().optional()
});

export const batchPrepareSchema = z.object({
  applicationIds: z.array(z.string().uuid()).min(1).max(5)
});

export const subscriptionCancelSchema = z.object({
  cancelAtPeriodEnd: z.boolean().default(true)
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertCv = z.infer<typeof insertCvSchema>;
export type Cv = typeof cvs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;
export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type Application = typeof applications.$inferSelect;
export type InsertApiUsage = z.infer<typeof insertApiUsageSchema>;
export type ApiUsage = typeof apiUsage.$inferSelect;
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;
export type Template = typeof templates.$inferSelect;
export type InsertAuthAccount = z.infer<typeof insertAuthAccountSchema>;
export type AuthAccount = typeof authAccounts.$inferSelect;
export type InsertOtpCode = z.infer<typeof insertOtpCodeSchema>;
export type OtpCode = typeof otpCodes.$inferSelect;
export type InsertUpiPayment = z.infer<typeof insertUpiPaymentSchema>;
export type UpiPayment = typeof upiPayments.$inferSelect;
export type RegisterData = z.infer<typeof registerSchema>;
export type LoginData = z.infer<typeof loginSchema>;
export type PlanType = z.infer<typeof planSchema>;
export type CreateSubscriptionData = z.infer<typeof createSubscriptionSchema>;
export type UpdateSubscriptionData = z.infer<typeof updateSubscriptionSchema>;

// New types for enhanced job search features
export type InsertSavedSearch = z.infer<typeof insertSavedSearchSchema>;
export type SavedSearch = typeof savedSearches.$inferSelect;
export type InsertSearchHistory = z.infer<typeof insertSearchHistorySchema>;
export type SearchHistory = typeof searchHistory.$inferSelect;
export type InsertJobBookmark = z.infer<typeof insertJobBookmarkSchema>;
export type JobBookmark = typeof jobBookmarks.$inferSelect;
export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;
export type UserPreferences = typeof userPreferences.$inferSelect;
export type InsertJobAlert = z.infer<typeof insertJobAlertSchema>;
export type JobAlert = typeof jobAlerts.$inferSelect;

// Enhanced search schemas for better filtering
export const jobSearchSchema = z.object({
  q: z.string().optional(), // Search query
  location: z.string().optional(),
  type: z.string().optional(),
  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
  experienceLevel: z.enum(['entry', 'mid', 'senior', 'executive']).optional(),
  workArrangement: z.enum(['remote', 'hybrid', 'onsite', 'flexible']).optional(),
  company: z.string().optional(),
  industry: z.string().optional(),
  postedWithin: z.enum(['1day', '3days', '1week', '2weeks', '1month']).optional(),
  sortBy: z.enum(['relevance', 'date', 'salary', 'match_score']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
});

export const saveSearchSchema = z.object({
  name: z.string().min(1).max(100),
  query: z.string().optional(),
  filters: z.record(z.any()),
  alertEnabled: z.boolean().optional(),
});

export const bookmarkJobSchema = z.object({
  jobId: z.string().uuid(),
  notes: z.string().max(500).optional(),
});

export const updatePreferencesSchema = z.object({
  preferredLocations: z.array(z.string()).optional(),
  preferredJobTypes: z.array(z.string()).optional(),
  salaryRange: z.object({
    min: z.number(),
    max: z.number(),
    currency: z.string().default('USD'),
  }).optional(),
  workArrangement: z.enum(['remote', 'hybrid', 'onsite', 'flexible']).optional(),
  experienceLevel: z.enum(['entry', 'mid', 'senior', 'executive']).optional(),
  industries: z.array(z.string()).optional(),
  companySize: z.enum(['startup', 'small', 'medium', 'large', 'enterprise']).optional(),
  benefits: z.array(z.string()).optional(),
});

export type JobSearchFilters = z.infer<typeof jobSearchSchema>;
export type SaveSearchData = z.infer<typeof saveSearchSchema>;
export type BookmarkJobData = z.infer<typeof bookmarkJobSchema>;
export type UpdatePreferencesData = z.infer<typeof updatePreferencesSchema>;

// New comprehensive application tracking types
export type InsertApplicationHistory = z.infer<typeof insertApplicationHistorySchema>;
export type ApplicationHistory = typeof applicationHistory.$inferSelect;
export type InsertEmailEvent = z.infer<typeof insertEmailEventSchema>;
export type EmailEvent = typeof emailEvents.$inferSelect;
export type InsertApplicationDocument = z.infer<typeof insertApplicationDocumentSchema>;
export type ApplicationDocument = typeof applicationDocuments.$inferSelect;
export type InsertApplicationNotification = z.infer<typeof insertApplicationNotificationSchema>;
export type ApplicationNotification = typeof applicationNotifications.$inferSelect;
export type InsertEmployerInteraction = z.infer<typeof insertEmployerInteractionSchema>;
export type EmployerInteraction = typeof employerInteractions.$inferSelect;
export type InsertApplicationAnalytics = z.infer<typeof insertApplicationAnalyticsSchema>;
export type ApplicationAnalytics = typeof applicationAnalytics.$inferSelect;

// Coupon system for marketing campaigns
export const coupons = pgTable("coupons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code").notNull().unique(), // e.g., "SAVE500"
  description: text("description"), // e.g., "₹500 off first month"
  discountType: varchar("discount_type").notNull(), // "fixed" or "percentage"
  discountValue: integer("discount_value").notNull(), // 500 for ₹500 off, or 20 for 20%
  maxUses: integer("max_uses"), // null for unlimited
  currentUses: integer("current_uses").default(0).notNull(),
  validFrom: timestamp("valid_from").defaultNow(),
  validUntil: timestamp("valid_until"),
  applicablePlans: text("applicable_plans").array().default([]).notNull(), // ["Premium"]
  oneTimePerUser: boolean("one_time_per_user").default(true).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_coupons_code").on(table.code),
  index("idx_coupons_active").on(table.isActive),
]);

// Track coupon usage by users
export const couponUsages = pgTable("coupon_usages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  couponId: varchar("coupon_id").notNull().references(() => coupons.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  usedAt: timestamp("used_at").defaultNow(),
  paymentReference: varchar("payment_reference"), // Link to payment
  discountApplied: integer("discount_applied").notNull(), // Actual discount amount in paise
}, (table) => [
  index("idx_coupon_usages_user").on(table.userId),
  index("idx_coupon_usages_coupon").on(table.couponId),
  unique("unique_user_coupon").on(table.userId, table.couponId), // Ensure one-time use per user
]);

// Coupon validation and insert schemas
export const insertCouponSchema = createInsertSchema(coupons).omit({
  id: true,
  currentUses: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCouponUsageSchema = createInsertSchema(couponUsages).omit({
  id: true,
  usedAt: true,
});

// Types for coupon system
export type InsertCoupon = z.infer<typeof insertCouponSchema>;
export type Coupon = typeof coupons.$inferSelect;
export type InsertCouponUsage = z.infer<typeof insertCouponUsageSchema>;
export type CouponUsage = typeof couponUsages.$inferSelect;