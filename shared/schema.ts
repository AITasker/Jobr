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
  plan: varchar("plan").default("Explorer").notNull(),
  creditsRemaining: integer("credits_remaining").default(3).notNull(),
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
});

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
});

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

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  cvs: many(cvs),
  applications: many(applications),
  apiUsage: many(apiUsage),
  authAccounts: many(authAccounts),
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

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users);
export const insertCvSchema = createInsertSchema(cvs).omit({ id: true, createdAt: true, updatedAt: true });
export const insertJobSchema = createInsertSchema(jobs).omit({ id: true, createdAt: true });
export const insertApplicationSchema = createInsertSchema(applications).omit({ id: true, createdAt: true, updatedAt: true });
export const insertApiUsageSchema = createInsertSchema(apiUsage).omit({ id: true, createdAt: true });
export const insertTemplateSchema = createInsertSchema(templates).omit({ id: true, createdAt: true });
export const insertAuthAccountSchema = createInsertSchema(authAccounts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOtpCodeSchema = createInsertSchema(otpCodes).omit({ id: true, createdAt: true });

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
export type RegisterData = z.infer<typeof registerSchema>;
export type LoginData = z.infer<typeof loginSchema>;