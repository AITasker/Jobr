import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  User,
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2,
  Copy,
  Download,
  Eye
} from "lucide-react";

interface Application {
  id: string;
  jobId: string;
  userId: string;
  status: string;
  matchScore?: number;
  preparationStatus?: 'pending' | 'preparing' | 'ready' | 'failed';
  coverLetter?: string;
  tailoredCv?: string;
  preparationMetadata?: any;
  job: {
    id: string;
    title: string;
    company: string;
    description: string;
    requirements: string[];
  };
}

interface UsageStats {
  creditsRemaining: number;
  apiCallsToday: number;
  maxDailyApiCalls: number;
  canMakeApiCall: boolean;
  usageByEndpoint: Record<string, number>;
  recentUsage: Array<{
    endpoint: string;
    createdAt: string;
    tokensUsed?: number;
    success: boolean;
  }>;
  totalTokensUsed: number;
}

interface ApplicationPreparationModalProps {
  application: Application;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApplicationPreparationModal({
  application,
  isOpen,
  onOpenChange,
}: ApplicationPreparationModalProps) {
  const [activeTab, setActiveTab] = useState("prepare");
  const [preparationProgress, setPreparationProgress] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch usage statistics
  const { data: usageStats, isLoading: loadingStats } = useQuery<UsageStats>({
    queryKey: ['/api/usage/stats'],
    enabled: isOpen,
  });

  // Prepare application mutation
  const prepareApplicationMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/applications/${application.id}/prepare`);
      return await response.json();
    },
    onMutate: () => {
      setPreparationProgress(10);
      setActiveTab("status");
    },
    onSuccess: (data: any) => {
      setPreparationProgress(100);
      queryClient.invalidateQueries({ queryKey: ['/api/applications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/usage/stats'] });
      
      // Update application data with prepared content
      application.coverLetter = data.coverLetter;
      application.tailoredCv = data.tailoredCv;
      application.preparationStatus = 'ready';
      application.preparationMetadata = data.preparationMetadata;
      
      toast({
        title: "Application Prepared Successfully",
        description: "Your cover letter and tailored CV are ready for review.",
      });
      
      setActiveTab("preview");
    },
    onError: (error: any) => {
      setPreparationProgress(0);
      toast({
        title: "Preparation Failed",
        description: error.message || "Failed to prepare application. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Copy to clipboard function
  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied to Clipboard",
        description: `${type} copied successfully.`,
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy to clipboard.",
        variant: "destructive",
      });
    }
  };

  // Simulate progress updates during preparation
  useEffect(() => {
    if (prepareApplicationMutation.isPending && preparationProgress < 90) {
      const timer = setInterval(() => {
        setPreparationProgress(prev => Math.min(prev + 10, 90));
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [prepareApplicationMutation.isPending, preparationProgress]);

  const canPrepareApplication = usageStats?.canMakeApiCall && 
    application.preparationStatus !== 'preparing' &&
    !prepareApplicationMutation.isPending;

  const getPreparationStatusBadge = () => {
    const status = application.preparationStatus;
    switch (status) {
      case 'ready':
        return <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          <CheckCircle className="w-3 h-3 mr-1" />
          Ready
        </Badge>;
      case 'preparing':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          Preparing
        </Badge>;
      case 'failed':
        return <Badge variant="destructive">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Failed
        </Badge>;
      default:
        return <Badge variant="outline">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>;
    }
  };

  const getUsageColor = (remaining: number, total: number) => {
    const percentage = (remaining / total) * 100;
    if (percentage > 50) return "bg-green-500";
    if (percentage > 20) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col" data-testid="dialog-application-preparation">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Prepare Application - {application.job.title}
          </DialogTitle>
          <DialogDescription>
            Generate AI-powered cover letter and tailored CV for {application.job.company}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="prepare" data-testid="tab-prepare">Prepare</TabsTrigger>
              <TabsTrigger value="status" data-testid="tab-status">Status</TabsTrigger>
              <TabsTrigger value="preview" disabled={!application.coverLetter} data-testid="tab-preview">Preview</TabsTrigger>
              <TabsTrigger value="usage" data-testid="tab-usage">Usage</TabsTrigger>
            </TabsList>

            {/* Prepare Tab */}
            <TabsContent value="prepare" className="flex-1 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Job Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <p className="text-sm font-medium">{application.job.title}</p>
                      <p className="text-sm text-muted-foreground">{application.job.company}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Match Score</p>
                      <div className="flex items-center gap-2">
                        <Progress value={application.matchScore || 0} className="flex-1" />
                        <span className="text-sm font-medium">{application.matchScore || 0}%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Status</p>
                      {getPreparationStatusBadge()}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      AI Preparation
                    </CardTitle>
                    <CardDescription>
                      Generate personalized application materials
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!canPrepareApplication && (
                      <Alert>
                        <AlertTriangle className="w-4 h-4" />
                        <AlertDescription>
                          {!usageStats?.canMakeApiCall 
                            ? "Daily API limit reached or no credits remaining. Please try again tomorrow."
                            : application.preparationStatus === 'preparing'
                            ? "Application is currently being prepared..."
                            : "Application preparation is in progress..."
                          }
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">What will be generated:</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Personalized cover letter highlighting relevant experience</li>
                        <li>• CV tailored to match job requirements and keywords</li>
                        <li>• Optimized content for ATS (Applicant Tracking Systems)</li>
                      </ul>
                    </div>

                    <Button 
                      onClick={() => prepareApplicationMutation.mutate()}
                      disabled={!canPrepareApplication}
                      className="w-full"
                      data-testid="button-prepare-application"
                    >
                      {prepareApplicationMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Preparing Application...
                        </>
                      ) : application.preparationStatus === 'ready' ? (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Re-prepare Application
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 mr-2" />
                          Prepare Application
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Status Tab */}
            <TabsContent value="status" className="flex-1 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Preparation Progress</CardTitle>
                  <CardDescription>
                    AI is analyzing your CV and the job requirements
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{preparationProgress}%</span>
                    </div>
                    <Progress value={preparationProgress} className="w-full" />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <div className={`w-2 h-2 rounded-full ${preparationProgress >= 25 ? 'bg-green-500' : 'bg-gray-300'}`} />
                      Analyzing job requirements
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className={`w-2 h-2 rounded-full ${preparationProgress >= 50 ? 'bg-green-500' : 'bg-gray-300'}`} />
                      Tailoring CV content
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className={`w-2 h-2 rounded-full ${preparationProgress >= 75 ? 'bg-green-500' : 'bg-gray-300'}`} />
                      Generating cover letter
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className={`w-2 h-2 rounded-full ${preparationProgress >= 100 ? 'bg-green-500' : 'bg-gray-300'}`} />
                      Finalizing application
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Preview Tab */}
            <TabsContent value="preview" className="flex-1 space-y-4">
              {application.coverLetter || application.tailoredCv ? (
                <div className="grid gap-4 md:grid-cols-2 h-full">
                  {application.coverLetter && (
                    <Card className="flex flex-col">
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Cover Letter
                          </span>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(application.coverLetter!, "Cover letter")}
                              data-testid="button-copy-cover-letter"
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex-1">
                        <ScrollArea className="h-[300px] border rounded-md p-3">
                          <pre className="text-sm whitespace-pre-wrap font-sans">
                            {application.coverLetter}
                          </pre>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}

                  {application.tailoredCv && (
                    <Card className="flex flex-col">
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Tailored CV
                          </span>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(application.tailoredCv!, "Tailored CV")}
                              data-testid="button-copy-tailored-cv"
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex-1">
                        <ScrollArea className="h-[300px] border rounded-md p-3">
                          <pre className="text-sm whitespace-pre-wrap font-sans">
                            {application.tailoredCv}
                          </pre>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Eye className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Content to Preview</h3>
                  <p className="text-muted-foreground">
                    Prepare your application to see the generated content here.
                  </p>
                </div>
              )}
            </TabsContent>

            {/* Usage Tab */}
            <TabsContent value="usage" className="flex-1 space-y-4">
              {loadingStats ? (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
                  <p>Loading usage statistics...</p>
                </div>
              ) : usageStats ? (
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        API Usage Overview
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="text-center">
                          <div className="text-2xl font-bold">{usageStats.creditsRemaining}</div>
                          <p className="text-sm text-muted-foreground">Credits Remaining</p>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold">{usageStats.apiCallsToday}</div>
                          <p className="text-sm text-muted-foreground">API Calls Today</p>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold">{usageStats.totalTokensUsed}</div>
                          <p className="text-sm text-muted-foreground">Total Tokens Used</p>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Daily API Limit</span>
                          <span>{usageStats.apiCallsToday} / {usageStats.maxDailyApiCalls}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={(usageStats.apiCallsToday / usageStats.maxDailyApiCalls) * 100} 
                            className="flex-1"
                          />
                          <div className={`w-3 h-3 rounded-full ${
                            getUsageColor(usageStats.maxDailyApiCalls - usageStats.apiCallsToday, usageStats.maxDailyApiCalls)
                          }`} />
                        </div>
                      </div>

                      {!usageStats.canMakeApiCall && (
                        <Alert>
                          <AlertTriangle className="w-4 h-4" />
                          <AlertDescription>
                            You've reached your daily API limit or run out of credits. 
                            Limits reset daily at midnight UTC.
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>

                  {usageStats.recentUsage.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Recent API Usage</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {usageStats.recentUsage.map((usage, index) => (
                            <div key={index} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${usage.success ? 'bg-green-500' : 'bg-red-500'}`} />
                                <span>{usage.endpoint}</span>
                              </div>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                {usage.tokensUsed && <span>{usage.tokensUsed} tokens</span>}
                                <span>{new Date(usage.createdAt).toLocaleTimeString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}