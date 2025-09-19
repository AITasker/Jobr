/**
 * Mock OpenAI Service
 * Provides predictable responses for CV parsing and job matching
 */
export class MockOpenAIService {
  private static isRunning = false;
  private static mockResponses = new Map<string, any>();

  /**
   * Start the mock service
   */
  static async start(): Promise<void> {
    console.log('🤖 Starting OpenAI mock service...');
    
    // Set up default mock responses
    this.setupDefaultResponses();
    
    // Override the global OpenAI functionality
    this.interceptOpenAIRequests();
    
    this.isRunning = true;
    console.log('✅ OpenAI mock service active');
  }

  /**
   * Stop the mock service
   */
  static async stop(): Promise<void> {
    this.isRunning = false;
    this.mockResponses.clear();
    console.log('🛑 OpenAI mock service stopped');
  }

  /**
   * Check if service is active
   */
  static isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Setup default mock responses for common scenarios
   */
  private static setupDefaultResponses(): void {
    // CV Parsing responses
    this.mockResponses.set('cv_parsing_john_doe', {
      name: 'John Doe',
      email: 'john.doe@test.com',
      phone: '+1-555-0123',
      skills: ['JavaScript', 'React', 'TypeScript', 'CSS', 'HTML', 'Git'],
      experience: '5 years of frontend development experience with modern web technologies',
      education: 'BS Computer Science, MIT 2018',
      summary: 'Experienced frontend developer with expertise in React and modern JavaScript'
    });

    this.mockResponses.set('cv_parsing_premium_user', {
      name: 'Premium User',
      email: 'premium.user@test.com',
      phone: '+1-555-0456',
      skills: ['JavaScript', 'React', 'Node.js', 'AWS', 'Docker', 'Kubernetes', 'Team Leadership'],
      experience: '8 years of full-stack development with team leadership experience',
      education: 'MS Computer Science, Stanford 2015',
      summary: 'Senior software engineer with full-stack expertise and leadership experience'
    });

    // Job Matching responses
    this.mockResponses.set('job_matching_frontend', {
      matchScore: 85,
      explanation: 'Strong match based on React and JavaScript expertise. Frontend experience aligns well with requirements.',
      skillsMatch: {
        matched: ['JavaScript', 'React', 'TypeScript', 'CSS', 'HTML'],
        missing: ['Vue.js'],
        score: 85
      },
      experienceMatch: {
        suitable: true,
        explanation: '5 years of experience meets the 5+ years requirement',
        score: 90
      },
      locationMatch: {
        suitable: true,
        explanation: 'Remote work acceptable, SF location preferred',
        score: 80
      },
      salaryMatch: {
        suitable: true,
        explanation: 'Salary range aligns with experience level',
        score: 85
      }
    });

    // Cover letter generation
    this.mockResponses.set('cover_letter_generation', {
      content: `Dear Hiring Manager,

I am excited to apply for the {position} role at {company}. With my {experience} years of experience in {field}, I believe I would be a valuable addition to your team.

My expertise in {skills} aligns perfectly with your requirements. I am particularly drawn to {company}'s commitment to innovation and would love the opportunity to contribute to your continued success.

I look forward to discussing how my background in {specialization} can benefit your team.

Best regards,
{name}`,
      metadata: {
        generatedWith: 'openai',
        tokensUsed: 150,
        processingTime: 2500
      }
    });

    // CV tailoring responses
    this.mockResponses.set('cv_tailoring', {
      content: `TAILORED CV FOR {position} AT {company}

{name}
{email} | {phone}

PROFESSIONAL SUMMARY
{summary_tailored_for_role}

KEY SKILLS
{skills_prioritized_for_role}

RELEVANT EXPERIENCE
{experience_highlighted_for_role}

EDUCATION
{education}

This CV has been specifically tailored for the {position} role, emphasizing relevant skills and experience.`,
      metadata: {
        generatedWith: 'openai',
        tokensUsed: 200,
        keyChanges: ['Prioritized relevant skills', 'Highlighted matching experience', 'Adjusted summary'],
        processingTime: 3000
      }
    });
  }

  /**
   * Intercept OpenAI requests and provide mock responses
   */
  private static interceptOpenAIRequests(): void {
    // Override global fetch for OpenAI API calls
    const originalFetch = global.fetch;
    
    global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = input.toString();
      
      // Intercept OpenAI API calls
      if (url.includes('api.openai.com')) {
        return this.handleOpenAIMockRequest(url, init);
      }
      
      // Pass through other requests
      return originalFetch(input, init);
    };
  }

  /**
   * Handle mock OpenAI API requests
   */
  private static async handleOpenAIMockRequest(url: string, init?: RequestInit): Promise<Response> {
    console.log('🎭 Intercepted OpenAI API request:', url);
    
    // Simulate API processing time
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));

    // Determine request type and return appropriate mock response
    if (url.includes('/chat/completions')) {
      const body = init?.body ? JSON.parse(init.body as string) : {};
      const messages = body.messages || [];
      const lastMessage = messages[messages.length - 1];
      
      let responseContent = '';
      
      // CV Parsing
      if (lastMessage?.content?.includes('parse') || lastMessage?.content?.includes('CV')) {
        if (lastMessage.content.includes('John Doe')) {
          responseContent = JSON.stringify(this.mockResponses.get('cv_parsing_john_doe'));
        } else if (lastMessage.content.includes('Premium User')) {
          responseContent = JSON.stringify(this.mockResponses.get('cv_parsing_premium_user'));
        } else {
          // Default CV parsing response
          responseContent = JSON.stringify({
            name: 'Test User',
            email: 'test@example.com',
            skills: ['JavaScript', 'React', 'Node.js'],
            experience: '3 years of software development experience',
            education: 'BS Computer Science',
            summary: 'Software developer with full-stack experience'
          });
        }
      }
      
      // Job Matching
      else if (lastMessage?.content?.includes('match') || lastMessage?.content?.includes('job')) {
        responseContent = JSON.stringify(this.mockResponses.get('job_matching_frontend'));
      }
      
      // Cover Letter Generation
      else if (lastMessage?.content?.includes('cover letter')) {
        const coverLetter = this.mockResponses.get('cover_letter_generation');
        responseContent = coverLetter.content;
      }
      
      // CV Tailoring
      else if (lastMessage?.content?.includes('tailor') || lastMessage?.content?.includes('customize')) {
        const tailoredCV = this.mockResponses.get('cv_tailoring');
        responseContent = tailoredCV.content;
      }
      
      // Default response
      else {
        responseContent = 'Mock OpenAI response for test scenario';
      }

      return new Response(JSON.stringify({
        id: 'chatcmpl-mock-' + Math.random().toString(36).substr(2, 9),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'gpt-4',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: responseContent
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Return error for unknown endpoints
    return new Response(JSON.stringify({
      error: {
        message: 'Mock OpenAI: Unknown endpoint',
        type: 'invalid_request_error',
        code: 'unknown_endpoint'
      }
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Add custom mock response for specific test scenarios
   */
  static addMockResponse(key: string, response: any): void {
    this.mockResponses.set(key, response);
  }

  /**
   * Clear all mock responses
   */
  static clearMockResponses(): void {
    this.mockResponses.clear();
    this.setupDefaultResponses();
  }

  /**
   * Simulate API failure for error testing
   */
  static simulateFailure(shouldFail = true): void {
    if (shouldFail) {
      const originalFetch = global.fetch;
      global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = input.toString();
        if (url.includes('api.openai.com')) {
          return new Response(JSON.stringify({
            error: {
              message: 'API rate limit exceeded',
              type: 'rate_limit_error',
              code: 'rate_limit_exceeded'
            }
          }), {
            status: 429,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return originalFetch(input, init);
      };
    } else {
      // Reset to normal mock behavior
      this.interceptOpenAIRequests();
    }
  }
}