import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';
import { MockOpenAIService } from '../mocks/mock-openai-service';

test.describe('CV Upload and AI Analysis Tests', () => {
  
  test.beforeEach(async () => {
    // Start with fresh test data
    await TestHelpers.seedFreshTestData();
  });

  test.afterEach(async ({ page }) => {
    // Take screenshot on failure
    if (test.info().status === 'failed') {
      await TestHelpers.takeScreenshot(page, `cv-upload-failure-${test.info().title}`);
    }
  });

  test('CV Upload and AI Processing Workflow - PDF Upload', async ({ page }) => {
    console.log('🧪 Testing CV upload and AI processing with PDF...');
    
    // Login
    await TestHelpers.loginAsTestUser(page);
    await page.waitForURL('/dashboard');

    // Verify initial state - no CV uploaded
    await expect(page.locator('[data-testid="cv-upload-area"]')).toBeVisible();
    await expect(page.locator('[data-testid="cv-upload-prompt"]')).toContainText('Upload your CV');

    // Create test PDF file
    const testPDFContent = Buffer.from(`%PDF-1.4
John Doe
Senior Software Engineer

EXPERIENCE:
Software Engineer at TechCorp (2019-2024)
- Developed React applications with TypeScript
- Led team of 5 developers
- Implemented CI/CD pipelines

EDUCATION:
BS Computer Science, MIT (2018)

SKILLS:
- JavaScript, TypeScript, React, Node.js
- AWS, Docker, Kubernetes
- Python, PostgreSQL, MongoDB`);

    // Upload PDF file
    const fileInput = page.locator('[data-testid="file-input-cv"]');
    await fileInput.setInputFiles({
      name: 'john-doe-resume.pdf',
      mimeType: 'application/pdf',
      buffer: testPDFContent
    });

    // Verify upload progress
    await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible();
    await expect(page.locator('[data-testid="upload-status"]')).toContainText('Uploading');

    // Wait for AI processing to complete
    await expect(page.locator('[data-testid="ai-processing"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="upload-status"]')).toContainText('AI is analyzing');

    // Wait for analysis completion
    await expect(page.locator('[data-testid="cv-analysis-complete"]')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('[data-testid="upload-status"]')).toContainText('analyzed successfully');

    // Verify CV analysis display
    await expect(page.locator('[data-testid="cv-analysis-display"]')).toBeVisible();
    
    // Check extracted information
    await expect(page.locator('[data-testid="cv-name"]')).toContainText('John Doe');
    await expect(page.locator('[data-testid="cv-email"]')).toContainText('john.doe@test.com');
    
    // Check skills extraction
    const skillsSection = page.locator('[data-testid="cv-skills"]');
    await expect(skillsSection).toContainText('JavaScript');
    await expect(skillsSection).toContainText('React');
    await expect(skillsSection).toContainText('TypeScript');
    
    // Check experience parsing
    const experienceSection = page.locator('[data-testid="cv-experience"]');
    await expect(experienceSection).toContainText('5 years');
    await expect(experienceSection).toContainText('frontend development');

    // Check education parsing
    const educationSection = page.locator('[data-testid="cv-education"]');
    await expect(educationSection).toContainText('MIT');
    await expect(educationSection).toContainText('Computer Science');

    // Verify job matching is triggered
    await expect(page.locator('[data-testid="job-matching-trigger"]')).toBeVisible();
    await page.click('[data-testid="button-find-jobs"]');
    
    // Wait for job matching results
    await expect(page.locator('[data-testid="job-matches"]')).toBeVisible({ timeout: 15000 });
    
    // Verify database state - CV should be saved
    const user = await TestHelpers.getCurrentUser('john.doe@test.com');
    const db = TestDatabase.getDb();
    const cvs = await db.query.cvs.findMany({
      where: (cvs, { eq }) => eq(cvs.userId, user.id)
    });
    
    expect(cvs).toHaveLength(1);
    expect(cvs[0].fileName).toBe('john-doe-resume.pdf');
    expect(cvs[0].skills).toContain('JavaScript');
    expect(cvs[0].skills).toContain('React');

    console.log('✅ CV upload and AI processing completed successfully');
  });

  test('CV Upload - DOCX File Processing', async ({ page }) => {
    console.log('🧪 Testing CV upload with DOCX file...');
    
    await TestHelpers.loginAsTestUser(page);

    // Create test DOCX content (simulated)
    const testDOCXContent = Buffer.from(`Premium User
Lead Software Engineer

PROFESSIONAL EXPERIENCE:
Senior Engineer at DataFlow Systems (2016-2024)
- Architected microservices using Node.js and AWS
- Managed team of 10+ engineers
- Implemented machine learning pipelines

TECHNICAL SKILLS:
- Full-stack development: Node.js, React, Python
- Cloud platforms: AWS, GCP, Azure
- Databases: PostgreSQL, MongoDB, Redis
- DevOps: Docker, Kubernetes, Terraform

EDUCATION:
MS Computer Science, Stanford University (2015)`);

    // Upload DOCX file
    const fileInput = page.locator('[data-testid="file-input-cv"]');
    await fileInput.setInputFiles({
      name: 'premium-user-cv.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: testDOCXContent
    });

    // Wait for processing
    await expect(page.locator('[data-testid="cv-analysis-complete"]')).toBeVisible({ timeout: 30000 });

    // Verify analysis results
    await expect(page.locator('[data-testid="cv-name"]')).toContainText('Premium User');
    await expect(page.locator('[data-testid="cv-skills"]')).toContainText('Node.js');
    await expect(page.locator('[data-testid="cv-skills"]')).toContainText('AWS');
    await expect(page.locator('[data-testid="cv-experience"]')).toContainText('8 years');

    console.log('✅ DOCX file processing completed successfully');
  });

  test('CV Upload Validation - File Size and Type Limits', async ({ page }) => {
    console.log('🧪 Testing CV upload validation...');
    
    await TestHelpers.loginAsTestUser(page);

    // Test invalid file type
    const invalidFile = Buffer.from('Invalid file content');
    let fileInput = page.locator('[data-testid="file-input-cv"]');
    
    await fileInput.setInputFiles({
      name: 'invalid.txt',
      mimeType: 'text/plain',
      buffer: invalidFile
    });

    // Should show validation error
    await expect(page.locator('[data-testid="upload-error"]')).toContainText('PDF, DOC, or DOCX');

    // Test file too large (simulate 10MB file)
    const largeFile = Buffer.alloc(10 * 1024 * 1024, 'x'); // 10MB
    fileInput = page.locator('[data-testid="file-input-cv"]');
    
    await fileInput.setInputFiles({
      name: 'large-cv.pdf',
      mimeType: 'application/pdf',
      buffer: largeFile
    });

    // Should show size error
    await expect(page.locator('[data-testid="upload-error"]')).toContainText('5MB limit');

    console.log('✅ CV upload validation completed successfully');
  });

  test('AI Processing Fallback - OpenAI Unavailable', async ({ page }) => {
    console.log('🧪 Testing AI processing fallback when OpenAI is unavailable...');
    
    // Simulate OpenAI API failure
    MockOpenAIService.simulateFailure(true);
    
    await TestHelpers.loginAsTestUser(page);

    // Upload valid CV
    const testPDFContent = Buffer.from('Simple CV content for fallback testing');
    const fileInput = page.locator('[data-testid="file-input-cv"]');
    
    await fileInput.setInputFiles({
      name: 'fallback-test.pdf',
      mimeType: 'application/pdf',
      buffer: testPDFContent
    });

    // Wait for processing with fallback
    await expect(page.locator('[data-testid="cv-upload-complete"]')).toBeVisible({ timeout: 30000 });

    // Should show fallback processing message
    await expect(page.locator('[data-testid="processing-method"]')).toContainText('basic parsing');
    
    // Should still allow basic functionality
    await expect(page.locator('[data-testid="cv-uploaded"]')).toBeVisible();

    // Reset OpenAI mock for other tests
    MockOpenAIService.simulateFailure(false);

    console.log('✅ AI processing fallback completed successfully');
  });

  test('CV Re-upload - Replace Existing CV', async ({ page }) => {
    console.log('🧪 Testing CV re-upload functionality...');
    
    await TestHelpers.loginAsTestUser(page);

    // Upload first CV
    await TestHelpers.uploadTestCV(page, 'first-cv.pdf');
    
    // Verify first CV is processed
    await expect(page.locator('[data-testid="cv-analysis-complete"]')).toBeVisible();
    const firstCVName = await page.locator('[data-testid="cv-file-name"]').textContent();
    expect(firstCVName).toContain('first-cv.pdf');

    // Upload second CV (replacement)
    const newCVContent = Buffer.from(`%PDF-1.4
Updated Resume
John Doe - Updated

NEW SKILLS:
- Vue.js, Angular, Svelte
- GraphQL, Apollo
- Microservices Architecture

UPDATED EXPERIENCE:
Senior Full-Stack Engineer (2024)
- Led digital transformation
- Architected cloud-native solutions`);

    const fileInput = page.locator('[data-testid="file-input-cv"]');
    await fileInput.setInputFiles({
      name: 'updated-cv.pdf',
      mimeType: 'application/pdf',
      buffer: newCVContent
    });

    // Wait for new CV processing
    await expect(page.locator('[data-testid="cv-analysis-complete"]')).toBeVisible({ timeout: 30000 });

    // Verify CV was replaced
    const updatedCVName = await page.locator('[data-testid="cv-file-name"]').textContent();
    expect(updatedCVName).toContain('updated-cv.pdf');

    // Verify updated skills are displayed
    await expect(page.locator('[data-testid="cv-skills"]')).toContainText('Vue.js');
    await expect(page.locator('[data-testid="cv-skills"]')).toContainText('GraphQL');

    console.log('✅ CV re-upload completed successfully');
  });

  test('Skills Extraction Accuracy - Multiple Skill Formats', async ({ page }) => {
    console.log('🧪 Testing skills extraction accuracy...');
    
    await TestHelpers.loginAsTestUser(page);

    // Create CV with various skill formats
    const skillsTestCV = Buffer.from(`%PDF-1.4
Skills Test Resume

TECHNICAL SKILLS:
• Programming Languages: JavaScript, Python, Java, C++
• Web Technologies: React.js, Vue.js, Angular, HTML5, CSS3
• Backend: Node.js, Express.js, Django, Spring Boot
• Databases: PostgreSQL, MongoDB, Redis, Elasticsearch
• Cloud & DevOps: AWS (EC2, S3, Lambda), Docker, Kubernetes, Terraform
• Version Control: Git, GitLab, GitHub Actions
• Testing: Jest, Cypress, PyTest, JUnit

OTHER COMPETENCIES:
- Project Management
- Team Leadership
- Agile/Scrum
- UI/UX Design
- Data Analysis`);

    const fileInput = page.locator('[data-testid="file-input-cv"]');
    await fileInput.setInputFiles({
      name: 'skills-test-cv.pdf',
      mimeType: 'application/pdf',
      buffer: skillsTestCV
    });

    await expect(page.locator('[data-testid="cv-analysis-complete"]')).toBeVisible({ timeout: 30000 });

    // Verify comprehensive skills extraction
    const skillsSection = page.locator('[data-testid="cv-skills"]');
    
    // Technical skills
    await expect(skillsSection).toContainText('JavaScript');
    await expect(skillsSection).toContainText('React.js');
    await expect(skillsSection).toContainText('Node.js');
    await expect(skillsSection).toContainText('PostgreSQL');
    await expect(skillsSection).toContainText('AWS');
    await expect(skillsSection).toContainText('Docker');
    
    // Soft skills
    await expect(skillsSection).toContainText('Team Leadership');
    await expect(skillsSection).toContainText('Project Management');

    console.log('✅ Skills extraction accuracy test completed successfully');
  });

  test('Job Matching Trigger - Post CV Analysis', async ({ page }) => {
    console.log('🧪 Testing job matching trigger after CV analysis...');
    
    await TestHelpers.loginAsTestUser(page);

    // Upload CV
    await TestHelpers.uploadTestCV(page);
    
    // Verify job matching section appears
    await expect(page.locator('[data-testid="job-matching-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="matching-explanation"]')).toContainText('based on your CV');

    // Click find jobs button
    await page.click('[data-testid="button-find-jobs"]');

    // Wait for job matching API call
    const jobMatchingCall = TestHelpers.waitForAPICall(page, '/api/jobs/matched', 'GET');
    await jobMatchingCall;

    // Verify job matches are displayed
    await expect(page.locator('[data-testid="job-matches"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="job-card"]')).toHaveCount.greaterThan(0);

    // Verify match scores are displayed
    const firstJobCard = page.locator('[data-testid="job-card"]').first();
    await expect(firstJobCard.locator('[data-testid="match-score"]')).toBeVisible();
    
    // Verify match explanation is shown
    await expect(firstJobCard.locator('[data-testid="match-explanation"]')).toBeVisible();

    console.log('✅ Job matching trigger test completed successfully');
  });

  test('CV Analysis Display - Comprehensive Information', async ({ page }) => {
    console.log('🧪 Testing comprehensive CV analysis display...');
    
    await TestHelpers.loginAsTestUser(page);

    // Upload detailed CV
    const detailedCV = Buffer.from(`%PDF-1.4
John Doe
Senior Software Engineer
john.doe@test.com | +1-555-0123 | San Francisco, CA

PROFESSIONAL SUMMARY:
Experienced software engineer with 8+ years in full-stack development, 
specializing in React and Node.js applications. Proven track record of 
leading technical teams and delivering scalable solutions.

WORK EXPERIENCE:
Senior Software Engineer | TechCorp Inc. | 2020-2024
• Led development of customer portal serving 100k+ users
• Implemented microservices architecture reducing response times by 40%
• Mentored team of 6 junior developers

Software Engineer | StartupXYZ | 2018-2020
• Built React/Node.js applications from scratch
• Integrated third-party APIs and payment systems
• Collaborated with design team on UI/UX improvements

EDUCATION:
Master of Science in Computer Science | MIT | 2018
Bachelor of Science in Computer Science | UC Berkeley | 2016

CERTIFICATIONS:
• AWS Certified Solutions Architect (2023)
• Google Cloud Professional Developer (2022)

PROJECTS:
• E-commerce platform with React/Redux (2024)
• Real-time chat application with Socket.io (2023)`);

    const fileInput = page.locator('[data-testid="file-input-cv"]');
    await fileInput.setInputFiles({
      name: 'detailed-cv.pdf',
      mimeType: 'application/pdf',
      buffer: detailedCV
    });

    await expect(page.locator('[data-testid="cv-analysis-complete"]')).toBeVisible({ timeout: 30000 });

    // Verify all analysis sections are displayed
    await expect(page.locator('[data-testid="cv-personal-info"]')).toBeVisible();
    await expect(page.locator('[data-testid="cv-summary"]')).toBeVisible();
    await expect(page.locator('[data-testid="cv-skills"]')).toBeVisible();
    await expect(page.locator('[data-testid="cv-experience"]')).toBeVisible();
    await expect(page.locator('[data-testid="cv-education"]')).toBeVisible();

    // Verify personal information
    await expect(page.locator('[data-testid="cv-name"]')).toContainText('John Doe');
    await expect(page.locator('[data-testid="cv-email"]')).toContainText('john.doe@test.com');
    await expect(page.locator('[data-testid="cv-phone"]')).toContainText('555-0123');
    await expect(page.locator('[data-testid="cv-location"]')).toContainText('San Francisco');

    // Verify experience calculation
    await expect(page.locator('[data-testid="cv-experience-years"]')).toContainText('8+ years');

    // Verify skills categorization
    const technicalSkills = page.locator('[data-testid="technical-skills"]');
    await expect(technicalSkills).toContainText('React');
    await expect(technicalSkills).toContainText('Node.js');
    await expect(technicalSkills).toContainText('AWS');

    console.log('✅ Comprehensive CV analysis display test completed successfully');
  });
});