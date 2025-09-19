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
  plan: varchar("plan").default("Free").notNull(), // Free, Premium, Pro
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  subscriptionStatus: varchar("subscription_status").default("active"), // active, canceled, past_due, incomplete
  subscriptionCurrentPeriodEnd: timestamp("subscription_current_period_end"),
  applicationsThisMonth: integer("applications_this_month").default(0).notNull(),
  monthlyApplicationsReset: timestamp("monthly_applications_reset").defaultNow(),
  creditsRemaining: integer("credits_remaining").default(5).notNull(), // Free tier gets 5 applications
  apiCallsToday: integer("api_calls_today").default(0).notNull(),
  lastApiCallReset: timestamp("last_api_call_reset").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_users_stripe_customer").on(table.stripeCustomerId).where(sql`${table.stripeCustomerId} IS NOT NULL`),
]);

// Subscriptions table for tracking subscription history and events
export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  stripeSubscriptionId: varchar("stripe_subscription_id").unique(),
  stripePriceId: varchar("stripe_price_id").notNull(),
  status: varchar("status").notNull(), // active, canceled, incomplete, incomplete_expired, past_due, trialing, unpaid
  plan: varchar("plan").notNull(), // Free, Premium, Pro
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  canceledAt: timestamp("canceled_at"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  trialStart: timestamp("trial_start"),
  trialEnd: timestamp("trial_end"),
  metadata: jsonb("metadata"), // Store additional Stripe metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_subscriptions_user_id").on(table.userId),
  index("idx_subscriptions_stripe_id").on(table.stripeSubscriptionId),
  index("idx_subscriptions_status").on(table.status),
]);

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
  status: varchar("status").default("applied").notNull(), // applied, viewed, interviewing, offered, rejected
  matchScore: integer("match_score").notNull(),
  tailoredCv: text("tailored_cv"),
  coverLetter: text("cover_letter"),
  preparationStatus: varchar("preparation_status").default("pending").notNull(), // pending, preparing, ready, failed
  preparationMetadata: jsonb("preparation_metadata"), // AI generation details, fallback used, etc.
  emailOpened: boolean("email_opened").default(false),
  appliedDate: timestamp("applied_date").defaultNow(),
  interviewDate: timestamp("interview_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueUserJob: unique("unique_user_job").on(table.userId, table.jobId),
  idxApplicationsUserAppliedDate: index("idx_applications_user_applied_date").on(table.userId, table.appliedDate.desc()),
  idxApplicationsStatus: index("idx_applications_status").on(table.status),
}));

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

// Stripe events table for webhook idempotency tracking
export const stripeEvents = pgTable("stripe_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").unique().notNull(), // Stripe event ID
  eventType: varchar("event_type").notNull(), // Event type from Stripe
  processed: boolean("processed").default(false),
  processedAt: timestamp("processed_at"),
  errorMessage: text("error_message"), // Store error if processing failed
  retryCount: integer("retry_count").default(0),
  metadata: jsonb("metadata"), // Store event data for debugging
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_stripe_events_event_id").on(table.eventId),
  index("idx_stripe_events_processed").on(table.processed),
  index("idx_stripe_events_created_at").on(table.createdAt),
]);

// Payment requests table for idempotency tracking
export const paymentRequests = pgTable("payment_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  idempotencyKey: varchar("idempotency_key").unique().notNull(), // userId+plan+time-bucket
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  plan: varchar("plan").notNull(),
  merchantTransactionId: varchar("merchant_transaction_id").unique().notNull(),
  paymentUrl: text("payment_url").notNull(),
  amount: integer("amount").notNull(), // Amount in paise
  status: varchar("status").default("pending").notNull(), // pending, completed, failed, expired
  provider: varchar("provider").default("phonepe").notNull(), // phonepe, stripe
  metadata: jsonb("metadata"), // Store additional payment data
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_payment_requests_idempotency_key").on(table.idempotencyKey),
  index("idx_payment_requests_user_id").on(table.userId),
  index("idx_payment_requests_status").on(table.status),
  index("idx_payment_requests_expires_at").on(table.expiresAt),
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
  apiUsage: many(apiUsage),
  authAccounts: many(authAccounts),
  subscriptions: many(subscriptions),
  paymentRequests: many(paymentRequests),
  savedSearches: many(savedSearches),
  searchHistory: many(searchHistory),
  jobBookmarks: many(jobBookmarks),
  preferences: one(userPreferences),
  jobAlerts: many(jobAlerts),
}));

export const paymentRequestsRelations = relations(paymentRequests, ({ one }) => ({
  user: one(users, {
    fields: [paymentRequests.userId],
    references: [users.id],
  }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
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

export const applicationsRelations = relations(applications, ({ one }) => ({
  user: one(users, {
    fields: [applications.userId],
    references: [users.id],
  }),
  job: one(jobs, {
    fields: [applications.jobId],
    references: [jobs.id],
  }),
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

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users);
export const insertCvSchema = createInsertSchema(cvs).omit({ id: true, createdAt: true, updatedAt: true });
export const insertJobSchema = createInsertSchema(jobs).omit({ id: true, createdAt: true });
export const insertApplicationSchema = createInsertSchema(applications).omit({ id: true, createdAt: true, updatedAt: true });
export const insertApiUsageSchema = createInsertSchema(apiUsage).omit({ id: true, createdAt: true });
export const insertTemplateSchema = createInsertSchema(templates).omit({ id: true, createdAt: true });
export const insertAuthAccountSchema = createInsertSchema(authAccounts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOtpCodeSchema = createInsertSchema(otpCodes).omit({ id: true, createdAt: true });
export const insertStripeEventSchema = createInsertSchema(stripeEvents).omit({ id: true, createdAt: true });
export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPaymentRequestSchema = createInsertSchema(paymentRequests).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSavedSearchSchema = createInsertSchema(savedSearches).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSearchHistorySchema = createInsertSchema(searchHistory).omit({ id: true, createdAt: true });
export const insertJobBookmarkSchema = createInsertSchema(jobBookmarks).omit({ id: true, createdAt: true });
export const insertUserPreferencesSchema = createInsertSchema(userPreferences).omit({ id: true, createdAt: true, updatedAt: true });
export const insertJobAlertSchema = createInsertSchema(jobAlerts).omit({ id: true, createdAt: true, updatedAt: true });

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
export type InsertStripeEvent = z.infer<typeof insertStripeEventSchema>;
export type StripeEvent = typeof stripeEvents.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;
export type InsertPaymentRequest = z.infer<typeof insertPaymentRequestSchema>;
export type PaymentRequest = typeof paymentRequests.$inferSelect;
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