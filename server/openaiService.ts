import OpenAI from "openai";

// Note: the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export interface ParsedCVData {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  skills: string[];
  experience: string;
  education: string;
  summary?: string | null;
  location?: string | null;
}

export class OpenAIService {
  static isAvailable(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  static async parseCVContent(cvText: string): Promise<ParsedCVData> {
    if (!openai) {
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
    }

    if (!cvText.trim()) {
      throw new Error('No CV content provided for parsing');
    }

    try {
      const prompt = `
You are an expert CV parser. Extract structured information from the following CV text and return it as JSON.

Please extract the following information:
- name: Full name of the person
- email: Email address
- phone: Phone number
- skills: Array of technical skills, technologies, and competencies
- experience: Summary of work experience (years and key roles)
- education: Educational background (degrees, institutions)
- summary: Brief professional summary or objective (if present)
- location: Current location or preferred location

If any field is not found, use null for strings/objects or an empty array for skills.

CV Text:
${cvText}

Return only valid JSON in the following format:
{
  "name": "string or null",
  "email": "string or null", 
  "phone": "string or null",
  "skills": ["skill1", "skill2"],
  "experience": "string or null",
  "education": "string or null",
  "summary": "string or null",
  "location": "string or null"
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "You are an expert CV parser that extracts structured information from resume/CV text and returns it as valid JSON. Always respond with properly formatted JSON only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 1000
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI API');
      }

      const parsedData = JSON.parse(content) as ParsedCVData;

      // Validate and sanitize the response
      return {
        name: parsedData.name || null,
        email: parsedData.email || null,
        phone: parsedData.phone || null,
        skills: Array.isArray(parsedData.skills) ? parsedData.skills.filter(skill => skill && skill.trim()) : [],
        experience: parsedData.experience || '',
        education: parsedData.education || '',
        summary: parsedData.summary || null,
        location: parsedData.location || null
      };
    } catch (error) {
      console.error('OpenAI parsing error:', error);
      
      if (error instanceof SyntaxError) {
        throw new Error('Failed to parse AI response. Please try uploading your CV again.');
      }
      
      if (typeof error === 'object' && error !== null && 'status' in error) {
        const statusError = error as { status: number; message?: string };
        if (statusError.status === 401) {
          throw new Error('OpenAI API authentication failed. Please check API key configuration.');
        }
        if (statusError.status === 429) {
          throw new Error('OpenAI API rate limit exceeded. Please try again in a moment.');
        }
      }
      
      throw new Error(`AI processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Fallback parser for when OpenAI is not available
  static parseCVContentFallback(cvText: string): ParsedCVData {
    const text = cvText.toLowerCase();
    
    // Simple regex patterns for basic extraction
    const emailPattern = /[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}/;
    const phonePattern = /(\+?\d{1,3})?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
    
    const emailMatch = cvText.match(emailPattern);
    const phoneMatch = cvText.match(phonePattern);
    
    // Extract skills based on common technical terms
    const commonSkills = [
      'javascript', 'typescript', 'python', 'java', 'react', 'angular', 'vue',
      'node.js', 'express', 'mongodb', 'postgresql', 'mysql', 'sql',
      'html', 'css', 'sass', 'tailwind', 'bootstrap', 'git', 'docker',
      'kubernetes', 'aws', 'azure', 'gcp', 'linux', 'windows',
      'figma', 'photoshop', 'illustrator', 'sketch'
    ];
    
    const foundSkills = commonSkills.filter(skill => 
      text.includes(skill) || text.includes(skill.replace('.js', ''))
    );
    
    return {
      name: null,
      email: emailMatch ? emailMatch[0] : null,
      phone: phoneMatch ? phoneMatch[0] : null,
      skills: foundSkills,
      experience: 'Unable to parse experience automatically. OpenAI integration required for detailed parsing.',
      education: 'Unable to parse education automatically. OpenAI integration required for detailed parsing.',
      summary: null,
      location: null
    };
  }
}