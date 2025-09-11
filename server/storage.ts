import {
  users,
  cvs,
  jobs,
  applications,
  type User,
  type UpsertUser,
  type Cv,
  type InsertCv,
  type Job,
  type InsertJob,
  type Application,
  type InsertApplication
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
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
  getApplicationWithJob(id: string): Promise<(Application & { job: Job }) | undefined>;
  checkExistingApplication(userId: string, jobId: string): Promise<Application | undefined>;
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
}

export const storage = new DatabaseStorage();