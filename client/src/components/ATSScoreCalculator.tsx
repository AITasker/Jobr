import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle, XCircle, Loader2, Target, Calculator } from "lucide-react";

interface ATSResult {
  ats_score: number;
  matched_must_haves: string[];
  missing_must_haves: string[];
  matched_nice_haves: string[];
  missing_nice_haves: string[];
  explanation: string;
}

interface ATSScoreCalculatorProps {
  cvData?: {
    originalContent?: string;
    fileName?: string;
  };
  onScoreUpdate?: (score: number | null, label: string) => void;
}

export function ATSScoreCalculator({ cvData, onScoreUpdate }: ATSScoreCalculatorProps) {
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState<ATSResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const calculateScore = async () => {
    if (!jobDescription.trim()) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please provide a job description to analyze against your CV."
      });
      return;
    }

    if (!cvData?.originalContent) {
      toast({
        variant: "destructive",
        title: "CV Data Missing",
        description: "No CV text available for analysis. Please upload a CV first."
      });
      return;
    }

    const currentJD = jobDescription.trim();
    setIsLoading(true);
    try {
      const response = await apiRequest('POST', '/api/ats/score', {
        jobDescription: currentJD,
        resumeText: cvData.originalContent
      });
      
      const data = await response.json();

      // Guard: Only update if JD hasn't changed during the request
      if (jobDescription.trim() !== currentJD) {
        // JD was changed or cleared while request was in flight, don't update
        return;
      }

      if (data.success) {
        setResult(data.data);
        onScoreUpdate?.(data.data.ats_score, `${data.data.ats_score}% Match`);
        toast({
          title: "ATS Score Calculated",
          description: `Your ATS score is ${data.data.ats_score}%`
        });
      } else {
        throw new Error(data.message || 'Failed to calculate score');
      }
    } catch (error) {
      console.error('ATS Score calculation error:', error);
      toast({
        variant: "destructive",
        title: "Calculation Failed",
        description: "Failed to calculate ATS score. Please try again."
      });
    } finally {
      setIsLoading(false);
    }
  };

  const clearJobDescription = () => {
    setJobDescription("");
    setResult(null);
    // Reset to baseline score if available
    // This will be handled by the parent component's state management
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreGradient = (score: number) => {
    if (score >= 80) return "from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30";
    if (score >= 60) return "from-yellow-50 to-orange-50 dark:from-yellow-950/30 dark:to-orange-950/30";
    return "from-red-50 to-pink-50 dark:from-red-950/30 dark:to-pink-950/30";
  };

  return (
    <div className="space-y-6">
      {/* Job Description Input */}
      <div className="space-y-2">
        <Label htmlFor="jobDescription" className="text-sm font-medium">
          Job Description
        </Label>
        <Textarea
          id="jobDescription"
          placeholder="Paste the job description here..."
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          className="min-h-[200px] text-sm"
          data-testid="textarea-job-description"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button 
          onClick={calculateScore} 
          disabled={isLoading || !jobDescription.trim()}
          className="flex-1"
          data-testid="button-calculate-score"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Calculating...
            </>
          ) : (
            <>
              <Calculator className="w-4 h-4 mr-2" />
              Calculate ATS Score
            </>
          )}
        </Button>
        {jobDescription && (
          <Button 
            variant="outline" 
            onClick={clearJobDescription}
            data-testid="button-clear-jd"
          >
            Clear
          </Button>
        )}
      </div>

      {/* Results Display */}
      {result && (
        <Card className={`bg-gradient-to-br ${getScoreGradient(result.ats_score)} border-0`}>
          <CardContent className="pt-6">
            <div className="text-center mb-6">
              <div className="flex justify-center mb-3">
                <div className="p-3 bg-white/50 dark:bg-gray-800/50 rounded-full">
                  <Target className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>
              <div className={`text-4xl font-bold mb-2 ${getScoreColor(result.ats_score)}`}>
                {result.ats_score}%
              </div>
              <div className="text-sm text-muted-foreground">
                ATS Match Score
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                {result.explanation}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Must-Have Skills */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Must-Have Skills</h4>
                <div className="space-y-2">
                  {result.matched_must_haves.map((skill, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                        {skill}
                      </Badge>
                    </div>
                  ))}
                  {result.missing_must_haves.map((skill, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <Badge variant="secondary" className="text-xs bg-red-100 text-red-800">
                        {skill}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Nice-to-Have Skills */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Nice-to-Have Skills</h4>
                <div className="space-y-2">
                  {result.matched_nice_haves.map((skill, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                        {skill}
                      </Badge>
                    </div>
                  ))}
                  {result.missing_nice_haves.map((skill, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <Badge variant="secondary" className="text-xs bg-red-100 text-red-800">
                        {skill}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}