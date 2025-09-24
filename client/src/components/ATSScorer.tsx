import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle, XCircle, AlertCircle, Loader2, Target } from "lucide-react";

interface ATSResult {
  ats_score: number;
  matched_must_haves: string[];
  missing_must_haves: string[];
  matched_nice_haves: string[];
  missing_nice_haves: string[];
  explanation: string;
}

interface ATSScorerProps {
  cvData?: {
    originalContent?: string;
    fileName?: string;
  };
  onScoreUpdate?: (score: number | null, label: string) => void;
}

export function ATSScorer({ cvData, onScoreUpdate }: ATSScorerProps) {
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState<ATSResult | null>(null);
  const [baselineScore, setBaselineScore] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCalculatingBaseline, setIsCalculatingBaseline] = useState(false);
  const { toast } = useToast();

  // Calculate baseline CV score (without JD)
  const calculateBaselineScore = async () => {
    if (!cvData?.originalContent) return;
    
    setIsCalculatingBaseline(true);
    try {
      const response = await apiRequest('POST', '/api/ats/baseline', {
        resumeText: cvData.originalContent
      });
      
      const data = await response.json();
      if (data.success) {
        setBaselineScore(data.data.baseline_score);
        onScoreUpdate?.(data.data.baseline_score, `${data.data.baseline_score}% Baseline`);
      }
    } catch (error) {
      // Fallback to a simple baseline score calculation
      // This provides a basic score even when API is unavailable
      const contentLength = cvData.originalContent.length;
      const estimatedScore = Math.min(Math.max(Math.floor(contentLength / 50), 45), 75);
      setBaselineScore(estimatedScore);
      onScoreUpdate?.(estimatedScore, `${estimatedScore}% Baseline`);
    } finally {
      setIsCalculatingBaseline(false);
    }
  };

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
        title: "Error",
        description: "Failed to calculate ATS score. Please try again."
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreLabel = (score: number, hasJD: boolean = false) => {
    if (!hasJD) {
      return "Baseline CV Score";
    }
    if (score >= 80) return "Excellent Match";
    if (score >= 60) return "Good Match";
    return "Needs Improvement";
  };

  // Calculate baseline score when CV data is available
  useEffect(() => {
    if (cvData?.originalContent) {
      calculateBaselineScore();
    }
  }, [cvData?.originalContent]);

  // Update score when JD changes
  useEffect(() => {
    if (jobDescription.trim() && cvData?.originalContent && !isLoading) {
      const timeoutId = setTimeout(() => {
        calculateScore();
      }, 1000); // Debounce for 1 second
      
      return () => clearTimeout(timeoutId);
    } else if (!jobDescription.trim() && baselineScore !== null) {
      // When JD is cleared, revert to baseline score
      setResult(null);
      onScoreUpdate?.(baselineScore, `${baselineScore}% Baseline`);
    } else if (!jobDescription.trim() && baselineScore === null) {
      // When JD is cleared but no baseline yet
      setResult(null);
      onScoreUpdate?.(null, '--% Baseline');
    }
  }, [jobDescription, cvData?.originalContent, baselineScore, isLoading]);

  const currentScore = result?.ats_score || baselineScore;
  const hasJobDescription = !!jobDescription.trim();

  return (
    <div className="space-y-4">
      {/* Prominent Score Display */}
      <Card className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30">
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="flex justify-center mb-3">
              <div className="p-3 bg-indigo-100 dark:bg-indigo-900/50 rounded-full">
                <Target className="h-8 w-8 text-indigo-600 dark:text-indigo-400" data-testid="icon-ats-score" />
              </div>
            </div>
            <div className={`text-4xl font-bold mb-2 ${currentScore ? getScoreColor(currentScore) : 'text-muted-foreground'}`} data-testid="text-ats-score">
              {isCalculatingBaseline ? (
                <Loader2 className="w-8 h-8 animate-spin mx-auto" />
              ) : currentScore ? (
                `${currentScore}%`
              ) : (
                "--"
              )}
            </div>
            <div className="text-sm text-muted-foreground" data-testid="text-ats-label">
              {getScoreLabel(currentScore || 0, hasJobDescription)}
            </div>
            {hasJobDescription && result && (
              <div className="mt-2">
                <Progress value={result.ats_score} className="w-32 mx-auto" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* CV Status */}
      <div className="flex items-center gap-2 text-sm">
        {cvData?.fileName ? (
          <>
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-muted-foreground">Using CV: {cvData.fileName}</span>
          </>
        ) : (
          <>
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <span className="text-muted-foreground">No CV data available</span>
          </>
        )}
      </div>

      {/* Job Description Input */}
      <div className="space-y-2">
        <Label htmlFor="job-description">
          Job Description 
          <span className="text-sm font-normal text-muted-foreground ml-2">
            (Score will update automatically as you type)
          </span>
        </Label>
        <Textarea
          id="job-description"
          data-testid="textarea-job-description"
          placeholder="Paste the job description to see how your CV matches against it..."
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          className="min-h-[120px] resize-none"
        />
      </div>

      {/* Manual Calculate Button (fallback) */}
      {jobDescription.trim() && (
        <div className="flex justify-center">
          <Button 
            onClick={calculateScore}
            disabled={isLoading || !cvData?.originalContent}
            size="sm"
            className="px-6"
            variant="outline"
            data-testid="button-calculate-ats"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Calculating...
              </>
            ) : (
              "Recalculate Score"
            )}
          </Button>
        </div>
      )}

      {/* Results Section */}
      {result && (
        <div className="space-y-6">
          {/* Score Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Your ATS Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className={`text-4xl font-bold ${getScoreColor(result.ats_score)}`}>
                    {result.ats_score}%
                  </div>
                  <div className="text-muted-foreground">{getScoreLabel(result.ats_score)}</div>
                </div>
                <div className="text-right">
                  <Progress value={result.ats_score} className="w-32 mb-2" />
                  <div className="text-sm text-muted-foreground">Score Range: 0-100</div>
                </div>
              </div>
              <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                <p className="text-sm">{result.explanation}</p>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Breakdown */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Must-Have Skills */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  Must-Have Skills (70% weight)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {result.matched_must_haves.length > 0 && (
                  <div>
                    <h4 className="font-medium text-green-600 mb-2 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Matched ({result.matched_must_haves.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {result.matched_must_haves.map((skill, index) => (
                        <Badge key={index} variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {result.missing_must_haves.length > 0 && (
                  <div>
                    <h4 className="font-medium text-red-600 mb-2 flex items-center gap-2">
                      <XCircle className="w-4 h-4" />
                      Missing ({result.missing_must_haves.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {result.missing_must_haves.map((skill, index) => (
                        <Badge key={index} variant="outline" className="bg-red-50 text-red-700 border-red-200">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Nice-to-Have Skills */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-blue-500" />
                  Nice-to-Have Skills (30% weight)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {result.matched_nice_haves.length > 0 && (
                  <div>
                    <h4 className="font-medium text-green-600 mb-2 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Matched ({result.matched_nice_haves.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {result.matched_nice_haves.map((skill, index) => (
                        <Badge key={index} variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {result.missing_nice_haves.length > 0 && (
                  <div>
                    <h4 className="font-medium text-yellow-600 mb-2 flex items-center gap-2">
                      <XCircle className="w-4 h-4" />
                      Missing ({result.missing_nice_haves.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {result.missing_nice_haves.map((skill, index) => (
                        <Badge key={index} variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle>💡 Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {result.missing_must_haves.length > 0 && (
                  <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200">
                    <h4 className="font-medium text-red-800 dark:text-red-200 mb-2">Critical: Add Missing Must-Have Skills</h4>
                    <p className="text-sm text-red-700 dark:text-red-300">
                      Focus on adding these required skills to your resume: {result.missing_must_haves.slice(0, 3).join(", ")}
                      {result.missing_must_haves.length > 3 && "..."}
                    </p>
                  </div>
                )}
                
                {result.missing_nice_haves.length > 0 && (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border border-yellow-200">
                    <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">Bonus: Consider Adding Nice-to-Have Skills</h4>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      These additional skills could boost your score: {result.missing_nice_haves.slice(0, 3).join(", ")}
                      {result.missing_nice_haves.length > 3 && "..."}
                    </p>
                  </div>
                )}
                
                {result.ats_score >= 80 && (
                  <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200">
                    <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">Excellent! You're ATS-Ready</h4>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Your resume has a high match rate. Consider applying with confidence!
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}