import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";

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
}

export function ATSScorer({ cvData }: ATSScorerProps) {
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

    setIsLoading(true);
    try {
      const response = await apiRequest('POST', '/api/ats/score', {
        jobDescription: jobDescription.trim(),
        resumeText: cvData.originalContent
      });
      
      const data = await response.json();

      if (data.success) {
        setResult(data.data);
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

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "Excellent Match";
    if (score >= 60) return "Good Match";
    return "Needs Improvement";
  };

  return (
    <div className="space-y-4">
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
        <Label htmlFor="job-description">Job Description</Label>
        <Textarea
          id="job-description"
          data-testid="textarea-job-description"
          placeholder="Paste the job description you want to analyze your CV against..."
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          className="min-h-[120px] resize-none"
        />
      </div>

      {/* Calculate Button */}
      <div className="flex justify-center">
        <Button 
          onClick={calculateScore}
          disabled={isLoading || !jobDescription.trim() || !cvData?.originalContent}
          size="sm"
          className="px-6"
          data-testid="button-calculate-ats"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Calculating...
            </>
          ) : (
            "Calculate ATS Score"
          )}
        </Button>
      </div>

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