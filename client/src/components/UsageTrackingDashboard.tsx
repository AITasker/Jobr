import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Zap,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle,
  Activity,
  CreditCard,
  Calendar,
  BarChart3,
  Loader2
} from "lucide-react";

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
    responseTime?: number;
  }>;
  totalTokensUsed: number;
}

export function UsageTrackingDashboard() {
  const { data: usageStats, isLoading, error } = useQuery<UsageStats>({
    queryKey: ['/api/usage/stats'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const getUsagePercentage = () => {
    if (!usageStats) return 0;
    return (usageStats.apiCallsToday / usageStats.maxDailyApiCalls) * 100;
  };

  const getUsageColor = (percentage: number) => {
    if (percentage < 50) return "bg-green-500";
    if (percentage < 80) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getCreditsColor = (remaining: number) => {
    if (remaining > 2) return "text-green-600";
    if (remaining > 0) return "text-yellow-600";
    return "text-red-600";
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatEndpointName = (endpoint: string) => {
    const endpointNames: Record<string, string> = {
      '/api/applications/prepare': 'Application Prep',
      '/api/cover-letter/generate': 'Cover Letter',
      '/api/cv/tailor': 'CV Tailoring',
      '/api/applications/batch-prepare': 'Batch Prep'
    };
    return endpointNames[endpoint] || endpoint.replace('/api/', '').replace('-', ' ');
  };

  const getSuccessRate = () => {
    if (!usageStats?.recentUsage.length) return 0;
    const successful = usageStats.recentUsage.filter(usage => usage.success).length;
    return (successful / usageStats.recentUsage.length) * 100;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading usage statistics...</p>
        </div>
      </div>
    );
  }

  if (error || !usageStats) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            Failed to load usage statistics. Please refresh the page and try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const usagePercentage = getUsagePercentage();

  return (
    <div className="space-y-6" data-testid="usage-tracking-dashboard">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Activity className="w-6 h-6" />
          Usage & Cost Tracking
        </h2>
        <p className="text-muted-foreground">
          Monitor your API usage and stay within free tier limits
        </p>
      </div>

      {/* Status Alert */}
      {!usageStats.canMakeApiCall && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            <strong>API Limit Reached:</strong> You've reached your daily API limit or run out of credits. 
            Limits reset daily at midnight UTC.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credits Remaining</CardTitle>
            <CreditCard className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getCreditsColor(usageStats.creditsRemaining)}`} data-testid="credits-remaining">
              {usageStats.creditsRemaining}
            </div>
            <p className="text-xs text-muted-foreground">
              Free tier credits
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily API Calls</CardTitle>
            <Zap className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="daily-api-calls">
              {usageStats.apiCallsToday}
            </div>
            <p className="text-xs text-muted-foreground">
              of {usageStats.maxDailyApiCalls} limit
            </p>
            <Progress value={usagePercentage} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tokens Used</CardTitle>
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="tokens-used">
              {usageStats.totalTokensUsed.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Total tokens consumed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            {getSuccessRate() >= 90 ? (
              <CheckCircle className="w-4 h-4 text-green-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="success-rate">
              {getSuccessRate().toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              API call success rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Usage Details */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* API Usage by Endpoint */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Usage by Feature
            </CardTitle>
            <CardDescription>
              Breakdown of API calls by different features
            </CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(usageStats.usageByEndpoint).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(usageStats.usageByEndpoint)
                  .sort(([,a], [,b]) => b - a)
                  .map(([endpoint, count]) => (
                    <div key={endpoint} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-primary rounded-full" />
                        <span className="text-sm font-medium">
                          {formatEndpointName(endpoint)}
                        </span>
                      </div>
                      <Badge variant="secondary" data-testid={`endpoint-count-${endpoint.replace(/[^a-zA-Z0-9]/g, '-')}`}>
                        {count} calls
                      </Badge>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Activity className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">No API usage data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent API Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Recent Activity
            </CardTitle>
            <CardDescription>
              Last 10 API calls and their status
            </CardDescription>
          </CardHeader>
          <CardContent>
            {usageStats.recentUsage.length > 0 ? (
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {usageStats.recentUsage.map((usage, index) => (
                    <div key={index} className="flex items-center justify-between p-2 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${usage.success ? 'bg-green-500' : 'bg-red-500'}`} />
                        <div>
                          <p className="text-sm font-medium">
                            {formatEndpointName(usage.endpoint)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatTime(usage.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {usage.tokensUsed && (
                          <p className="text-xs text-muted-foreground">
                            {usage.tokensUsed} tokens
                          </p>
                        )}
                        <Badge 
                          variant={usage.success ? "secondary" : "destructive"}
                          className="text-xs"
                        >
                          {usage.success ? 'Success' : 'Failed'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">No recent activity</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Usage Guidelines */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Free Tier Guidelines
          </CardTitle>
          <CardDescription>
            Tips to optimize your API usage within free tier limits
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Current Limits</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Daily API calls: {usageStats.maxDailyApiCalls}</li>
                <li>• Free credits: 3 per user</li>
                <li>• Limits reset: Daily at midnight UTC</li>
                <li>• Batch processing: Up to 5 applications</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Optimization Tips</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Use batch preparation for multiple applications</li>
                <li>• Fallback templates are used when limits reached</li>
                <li>• CV tailoring is more cost-effective than full prep</li>
                <li>• Review preparation status before re-generating</li>
              </ul>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${getUsageColor(usagePercentage)}`} />
              <span className="text-sm font-medium">
                Usage Status: {usagePercentage.toFixed(1)}% of daily limit
              </span>
            </div>
            {usageStats.canMakeApiCall ? (
              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                <CheckCircle className="w-3 h-3 mr-1" />
                API Available
              </Badge>
            ) : (
              <Badge variant="destructive">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Limit Reached
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}