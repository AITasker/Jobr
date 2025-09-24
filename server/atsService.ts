import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export interface ATSScoreResult {
  ats_score: number;
  matched_must_haves: string[];
  missing_must_haves: string[];
  matched_nice_haves: string[];
  missing_nice_haves: string[];
  explanation: string;
}

interface SkillsExtractionResult {
  must_have_skills: string[];
  nice_to_have_skills: string[];
  matched_must_haves: string[];
  missing_must_haves: string[];
  matched_nice_haves: string[];
  missing_nice_haves: string[];
}

export class ATSService {
  // Step 1: Extract and match skills using OpenAI
  private static async extractAndMatchSkills(jobDescription: string, resumeText: string): Promise<SkillsExtractionResult> {
    if (!openai) {
      throw new Error("OpenAI API not configured");
    }

    const prompt = `=== INPUT ===
Job Description:
"""
${jobDescription}
"""

Candidate Resume:
"""
${resumeText}
"""

=== TASK ===
1. Extract two keyword sets from the Job Description:
   a. "must_have_skills" – skills or requirements explicitly stated as required (e.g., "Required:", "Must have:", "Essential:").
   b. "nice_to_have_skills" – skills or qualifications described as preferred/optional (e.g., "Preferred:", "Nice to have:", "Bonus:").

2. Match those keyword sets against the Candidate Resume:
   • A skill is a match if the exact phrase or a clear synonym appears in the resume.
   • Count each unique skill only once.
   • Be strict about matching - only count clear matches, not loose interpretations.

3. Return ONLY valid JSON in exactly this format:
{
  "must_have_skills": ["skill1", "skill2", ...],
  "nice_to_have_skills": ["skill3", "skill4", ...],
  "matched_must_haves": ["skill1", ...],
  "missing_must_haves": ["skill2", ...],
  "matched_nice_haves": ["skill3", ...],
  "missing_nice_haves": ["skill4", ...]
}

=== RULES ===
• Output strictly valid JSON—no extra text, code fences, or commentary.
• If no skills are found in a category, return an empty array for that key.
• Ignore layout or formatting artifacts from the resume text.
• Be conservative in matching - only match clear, unambiguous skill presence.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "You are an expert ATS skill extraction system. Extract and match skills precisely from job descriptions and resumes. Always respond with valid JSON only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" }
      });

      const result = response.choices[0].message.content;
      if (!result) {
        throw new Error("No response from OpenAI");
      }

      const parsedResult = JSON.parse(result);
      
      // Validate the response structure
      if (!Array.isArray(parsedResult.must_have_skills) ||
          !Array.isArray(parsedResult.nice_to_have_skills) ||
          !Array.isArray(parsedResult.matched_must_haves) ||
          !Array.isArray(parsedResult.missing_must_haves) ||
          !Array.isArray(parsedResult.matched_nice_haves) ||
          !Array.isArray(parsedResult.missing_nice_haves)) {
        throw new Error("Invalid skills extraction response format from OpenAI");
      }

      return parsedResult as SkillsExtractionResult;
    } catch (error) {
      console.error("Skills extraction error:", error);
      throw new Error(`Failed to extract skills: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Step 2: Calculate deterministic ATS score using extracted skills
  private static calculateDeterministicScore(skillsData: SkillsExtractionResult): { score: number; explanation: string } {
    const totalMustHave = skillsData.must_have_skills.length;
    const totalNiceToHave = skillsData.nice_to_have_skills.length;
    const matchedMustHave = skillsData.matched_must_haves.length;
    const matchedNiceToHave = skillsData.matched_nice_haves.length;

    // Handle edge cases
    if (totalMustHave === 0 && totalNiceToHave === 0) {
      return {
        score: 0,
        explanation: "No skills were identified in the job description for scoring."
      };
    }

    // Calculate weighted scores according to the specified algorithm
    let mustHaveScore = 0;
    let niceToHaveScore = 0;

    if (totalMustHave > 0) {
      mustHaveScore = (matchedMustHave / totalMustHave) * 70;
    }

    if (totalNiceToHave > 0) {
      niceToHaveScore = (matchedNiceToHave / totalNiceToHave) * 30;
    }

    // If only one category exists, scale appropriately
    if (totalMustHave === 0) {
      // Only nice-to-have skills exist, scale them to full weight
      niceToHaveScore = (matchedNiceToHave / totalNiceToHave) * 100;
    } else if (totalNiceToHave === 0) {
      // Only must-have skills exist, scale them to full weight
      mustHaveScore = (matchedMustHave / totalMustHave) * 100;
    }

    const finalScore = Math.max(0, Math.min(100, Math.round(mustHaveScore + niceToHaveScore)));

    const explanation = totalMustHave === 0 
      ? `Score based entirely on ${totalNiceToHave} nice-to-have skills (${matchedNiceToHave} matched).`
      : totalNiceToHave === 0
      ? `Score based entirely on ${totalMustHave} must-have skills (${matchedMustHave} matched).`
      : `Score calculated from ${matchedMustHave}/${totalMustHave} must-have skills (70% weight) + ${matchedNiceToHave}/${totalNiceToHave} nice-to-have skills (30% weight).`;

    return { score: finalScore, explanation };
  }

  // Main public method
  static async calculateATSScore(jobDescription: string, resumeText: string): Promise<ATSScoreResult> {
    try {
      // Step 1: Extract and match skills using AI
      const skillsData = await this.extractAndMatchSkills(jobDescription, resumeText);
      
      // Step 2: Calculate deterministic score on server
      const { score, explanation } = this.calculateDeterministicScore(skillsData);
      
      // Step 3: Return validated result
      return {
        ats_score: score,
        matched_must_haves: skillsData.matched_must_haves,
        missing_must_haves: skillsData.missing_must_haves,
        matched_nice_haves: skillsData.matched_nice_haves,
        missing_nice_haves: skillsData.missing_nice_haves,
        explanation
      };
    } catch (error) {
      console.error("ATS Score calculation error:", error);
      throw new Error(`Failed to calculate ATS score: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}