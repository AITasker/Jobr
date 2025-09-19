import { TestDatabase } from './test-database';
import * as schema from '../../shared/schema';
import bcrypt from 'bcryptjs';

/**
 * Test Data Seeder
 * Creates deterministic test data for E2E tests
 */
export class TestDataSeeder {
  
  /**
   * Seed all test data
   */
  static async seedAll(): Promise<void> {
    console.log('🌱 Seeding all test data...');
    
    await this.seedUsers();
    await this.seedJobs();
    await this.seedCVs();
    await this.seedTemplates();
    await this.seedApplications();
    await this.seedUserPreferences();
    
    console.log('✅ All test data seeded successfully');
  }

  /**
   * Seed test users with different roles and states
   */
  static async seedUsers(): Promise<void> {
    const db = TestDatabase.getDb();
    const passwordHash = await bcrypt.hash('testpassword123', 10);

    const testUsers = [
      {
        id: 'test-user-1',
        email: 'john.doe@test.com',
        firstName: 'John',
        lastName: 'Doe',
        plan: 'Free',
        creditsRemaining: 5,
        applicationsThisMonth: 0
      },
      {
        id: 'test-user-premium',
        email: 'premium.user@test.com',
        firstName: 'Premium',
        lastName: 'User',
        plan: 'Premium',
        creditsRemaining: 50,
        applicationsThisMonth: 12,
        stripeCustomerId: 'cus_test_premium'
      },
      {
        id: 'test-user-pro',
        email: 'pro.user@test.com',
        firstName: 'Pro',
        lastName: 'User',
        plan: 'Pro',
        creditsRemaining: 100,
        applicationsThisMonth: 25,
        stripeCustomerId: 'cus_test_pro'
      },
      {
        id: 'test-user-new',
        email: 'new.user@test.com',
        firstName: 'New',
        lastName: 'User',
        plan: 'Free',
        creditsRemaining: 5,
        applicationsThisMonth: 0
      }
    ];

    await db.insert(schema.users).values(testUsers);

    // Create auth accounts for password authentication
    const authAccounts = testUsers.map(user => ({
      id: `auth-${user.id}`,
      userId: user.id,
      provider: 'email',
      email: user.email,
      passwordHash: passwordHash,
      verified: true
    }));

    await db.insert(schema.authAccounts).values(authAccounts);
    
    console.log(`👥 Seeded ${testUsers.length} test users`);
  }

  /**
   * Seed test job listings
   */
  static async seedJobs(): Promise<void> {
    const db = TestDatabase.getDb();

    const testJobs = [
      {
        id: 'job-frontend-1',
        title: 'Senior Frontend Developer',
        company: 'TechCorp Inc',
        location: 'San Francisco, CA',
        type: 'Full-time',
        salary: '$120,000 - $160,000',
        description: 'We are seeking a Senior Frontend Developer to join our dynamic team. You will be responsible for building responsive web applications using modern JavaScript frameworks.',
        requirements: ['JavaScript', 'React', 'TypeScript', 'CSS', 'HTML', '5+ years experience']
      },
      {
        id: 'job-backend-1',
        title: 'Backend Engineer',
        company: 'DataFlow Systems',
        location: 'New York, NY',
        type: 'Full-time',
        salary: '$130,000 - $170,000',
        description: 'Join our backend team to build scalable APIs and microservices. Experience with Node.js and database systems required.',
        requirements: ['Node.js', 'PostgreSQL', 'API Design', 'Docker', 'AWS', '3+ years experience']
      },
      {
        id: 'job-fullstack-1',
        title: 'Full Stack Developer',
        company: 'StartupXYZ',
        location: 'Remote',
        type: 'Full-time',
        salary: '$100,000 - $140,000',
        description: 'Looking for a versatile full stack developer to work on our innovative platform. Must be comfortable with both frontend and backend technologies.',
        requirements: ['JavaScript', 'React', 'Node.js', 'MongoDB', 'Express', '2+ years experience']
      },
      {
        id: 'job-devops-1',
        title: 'DevOps Engineer',
        company: 'CloudTech Solutions',
        location: 'Austin, TX',
        type: 'Contract',
        salary: '$90/hour',
        description: 'DevOps engineer needed to manage our cloud infrastructure and CI/CD pipelines. Strong AWS and Kubernetes experience required.',
        requirements: ['AWS', 'Kubernetes', 'Docker', 'Terraform', 'CI/CD', '4+ years experience']
      },
      {
        id: 'job-mobile-1',
        title: 'Mobile App Developer',
        company: 'MobileFirst Ltd',
        location: 'Chicago, IL',
        type: 'Full-time',
        salary: '$110,000 - $150,000',
        description: 'Develop cutting-edge mobile applications for iOS and Android platforms. React Native experience preferred.',
        requirements: ['React Native', 'iOS', 'Android', 'JavaScript', 'Mobile UI/UX', '3+ years experience']
      },
      {
        id: 'job-entry-level',
        title: 'Junior Frontend Developer',
        company: 'Learning Labs',
        location: 'Seattle, WA',
        type: 'Full-time',
        salary: '$70,000 - $90,000',
        description: 'Great opportunity for a junior developer to grow their skills in a supportive environment. Mentorship provided.',
        requirements: ['JavaScript', 'React', 'CSS', 'HTML', 'Git', '0-2 years experience']
      }
    ];

    await db.insert(schema.jobs).values(testJobs);
    
    console.log(`💼 Seeded ${testJobs.length} test jobs`);
  }

  /**
   * Seed test CV data
   */
  static async seedCVs(): Promise<void> {
    const db = TestDatabase.getDb();

    const testCVs = [
      {
        id: 'cv-john-doe',
        userId: 'test-user-1',
        fileName: 'john_doe_resume.pdf',
        originalContent: 'John Doe\nSoftware Engineer\n\nExperience:\n- 5 years of frontend development\n- Expert in React, JavaScript, TypeScript\n\nEducation:\n- BS Computer Science, MIT 2018',
        parsedData: {
          name: 'John Doe',
          email: 'john.doe@test.com',
          phone: '+1-555-0123',
          skills: ['JavaScript', 'React', 'TypeScript', 'CSS', 'HTML', 'Git'],
          experience: '5 years of frontend development experience with modern web technologies',
          education: 'BS Computer Science, MIT 2018',
          summary: 'Experienced frontend developer with expertise in React and modern JavaScript'
        },
        skills: ['JavaScript', 'React', 'TypeScript', 'CSS', 'HTML', 'Git'],
        experience: '5 years of frontend development experience',
        education: 'BS Computer Science, MIT 2018'
      },
      {
        id: 'cv-premium-user',
        userId: 'test-user-premium',
        fileName: 'premium_user_cv.docx',
        originalContent: 'Premium User\nSenior Software Engineer\n\nExperience:\n- 8 years full-stack development\n- Team lead experience\n- Cloud architecture\n\nEducation:\n- MS Computer Science, Stanford 2015',
        parsedData: {
          name: 'Premium User',
          email: 'premium.user@test.com',
          phone: '+1-555-0456',
          skills: ['JavaScript', 'React', 'Node.js', 'AWS', 'Docker', 'Kubernetes', 'Team Leadership'],
          experience: '8 years of full-stack development with team leadership experience',
          education: 'MS Computer Science, Stanford 2015',
          summary: 'Senior software engineer with full-stack expertise and leadership experience'
        },
        skills: ['JavaScript', 'React', 'Node.js', 'AWS', 'Docker', 'Kubernetes', 'Team Leadership'],
        experience: '8 years full-stack development, team lead experience',
        education: 'MS Computer Science, Stanford 2015'
      },
      {
        id: 'cv-new-user',
        userId: 'test-user-new',
        fileName: 'new_user_resume.pdf',
        originalContent: 'New User\nJunior Developer\n\nEducation:\n- BS Computer Science, UC Berkeley 2023\n\nProjects:\n- Personal portfolio website\n- React todo app',
        parsedData: {
          name: 'New User',
          email: 'new.user@test.com',
          phone: '+1-555-0789',
          skills: ['JavaScript', 'React', 'HTML', 'CSS', 'Git'],
          experience: 'Recent graduate with personal projects and internship experience',
          education: 'BS Computer Science, UC Berkeley 2023',
          summary: 'Recent computer science graduate eager to start career in software development'
        },
        skills: ['JavaScript', 'React', 'HTML', 'CSS', 'Git'],
        experience: 'Recent graduate, personal projects',
        education: 'BS Computer Science, UC Berkeley 2023'
      }
    ];

    await db.insert(schema.cvs).values(testCVs);
    
    console.log(`📄 Seeded ${testCVs.length} test CVs`);
  }

  /**
   * Seed application templates
   */
  static async seedTemplates(): Promise<void> {
    const db = TestDatabase.getDb();

    const templates = [
      {
        id: 'template-cover-letter-1',
        type: 'cover_letter',
        name: 'Standard Cover Letter',
        template: `Dear Hiring Manager,

I am writing to express my interest in the {{position}} role at {{company}}. With my background in {{experience}}, I believe I would be a valuable addition to your team.

My key skills include {{skills}}, which align well with the requirements for this position. I am particularly excited about the opportunity to {{specific_interest}}.

Thank you for considering my application. I look forward to hearing from you.

Best regards,
{{name}}`,
        variables: ['position', 'company', 'experience', 'skills', 'specific_interest', 'name'],
        isDefault: true
      },
      {
        id: 'template-cv-summary-1',
        type: 'cv_summary',
        name: 'Professional Summary',
        template: `{{name}} is a {{experience_level}} professional with {{years}} years of experience in {{field}}. Specializing in {{specialties}}, they have demonstrated expertise in {{key_skills}}. {{name}} is passionate about {{interests}} and seeking opportunities to {{career_goals}}.`,
        variables: ['name', 'experience_level', 'years', 'field', 'specialties', 'key_skills', 'interests', 'career_goals'],
        isDefault: true
      }
    ];

    await db.insert(schema.templates).values(templates);
    
    console.log(`📝 Seeded ${templates.length} test templates`);
  }

  /**
   * Seed test applications
   */
  static async seedApplications(): Promise<void> {
    const db = TestDatabase.getDb();

    const testApplications = [
      {
        id: 'app-john-frontend',
        userId: 'test-user-1',
        jobId: 'job-frontend-1',
        status: 'applied',
        matchScore: 85,
        preparationStatus: 'ready',
        appliedDate: new Date('2024-01-15'),
        emailSentAt: new Date('2024-01-15'),
        emailOpened: false,
        tailoredCv: 'Tailored CV content for frontend role...',
        coverLetter: 'Dear TechCorp team, I am excited to apply...'
      },
      {
        id: 'app-premium-backend',
        userId: 'test-user-premium',
        jobId: 'job-backend-1',
        status: 'viewed',
        matchScore: 92,
        preparationStatus: 'ready',
        appliedDate: new Date('2024-01-10'),
        emailSentAt: new Date('2024-01-10'),
        emailOpened: true,
        emailOpenedAt: new Date('2024-01-12'),
        viewedByEmployerAt: new Date('2024-01-12'),
        tailoredCv: 'Tailored CV content for backend role...',
        coverLetter: 'Dear DataFlow Systems team, With my extensive backend experience...'
      }
    ];

    await db.insert(schema.applications).values(testApplications);
    
    console.log(`📋 Seeded ${testApplications.length} test applications`);
  }

  /**
   * Seed user preferences
   */
  static async seedUserPreferences(): Promise<void> {
    const db = TestDatabase.getDb();

    const preferences = [
      {
        id: 'pref-john-doe',
        userId: 'test-user-1',
        preferredLocations: ['San Francisco, CA', 'New York, NY', 'Remote'],
        preferredJobTypes: ['Full-time'],
        salaryRange: { min: 100000, max: 150000, currency: 'USD' },
        workArrangement: 'remote',
        experienceLevel: 'mid',
        industries: ['Technology', 'Software'],
        companySize: 'medium',
        benefits: ['health_insurance', 'flexible_hours', 'remote_work']
      },
      {
        id: 'pref-premium-user',
        userId: 'test-user-premium',
        preferredLocations: ['San Francisco, CA', 'Seattle, WA'],
        preferredJobTypes: ['Full-time'],
        salaryRange: { min: 150000, max: 200000, currency: 'USD' },
        workArrangement: 'hybrid',
        experienceLevel: 'senior',
        industries: ['Technology', 'Fintech'],
        companySize: 'large',
        benefits: ['health_insurance', 'stock_options', 'unlimited_pto']
      }
    ];

    await db.insert(schema.userPreferences).values(preferences);
    
    console.log(`⚙️ Seeded ${preferences.length} user preferences`);
  }

  /**
   * Get seeded test data IDs for use in tests
   */
  static getTestDataIds() {
    return {
      users: {
        john: 'test-user-1',
        premium: 'test-user-premium',
        pro: 'test-user-pro',
        new: 'test-user-new'
      },
      jobs: {
        frontend: 'job-frontend-1',
        backend: 'job-backend-1',
        fullstack: 'job-fullstack-1',
        devops: 'job-devops-1',
        mobile: 'job-mobile-1',
        junior: 'job-entry-level'
      },
      cvs: {
        john: 'cv-john-doe',
        premium: 'cv-premium-user',
        new: 'cv-new-user'
      },
      applications: {
        johnFrontend: 'app-john-frontend',
        premiumBackend: 'app-premium-backend'
      }
    };
  }
}