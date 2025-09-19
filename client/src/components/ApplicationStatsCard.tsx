import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/queryClient'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  TrendingUp, 
  TrendingDown, 
  Mail, 
  Calendar,
  Target,
  Activity,
  BarChart3,
  Zap,
  Award,
  Clock
} from 'lucide-react'

interface ApplicationStatsCardProps {
  className?: string
  onViewAnalytics?: () => void
}

export function ApplicationStatsCard({ className, onViewAnalytics }: ApplicationStatsCardProps) {
  // Fetch comprehensive analytics
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['comprehensive-analytics'],
    queryFn: () => apiRequest('/api/analytics/insights'),
    refetchInterval: 30000 // Refresh every 30 seconds
  })

  // Fetch success rates
  const { data: successRates } = useQuery({
    queryKey: ['success-rates'],
    queryFn: () => apiRequest('/api/analytics/success-rates')
  })

  // Fetch email analytics
  const { data: emailAnalytics } = useQuery({
    queryKey: ['email-analytics'],
    queryFn: () => apiRequest('/api/user/email/analytics')
  })

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="space-y-2">
              <div className="h-3 bg-muted rounded"></div>
              <div className="h-3 bg-muted rounded w-5/6"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const stats = {
    totalApplications: analytics?.insights?.totalApplications || 0,
    successRate: analytics?.insights?.successMetrics?.overall?.successRate || 0,
    avgTimeToOffer: analytics?.insights?.successMetrics?.overall?.averageTimeToOffer || 0,
    emailOpenRate: emailAnalytics?.analytics?.openRate || 0,
    emailResponseRate: emailAnalytics?.analytics?.responseRate || 0,
    engagementScore: analytics?.insights?.engagementMetrics?.averageEngagementScore || 0,
    activeApplications: analytics?.insights?.statusBreakdown?.find((s: any) => 
      ['applied', 'viewed', 'interview_scheduled', 'interviewing'].includes(s.status)
    )?.count || 0,
    improvementTrend: analytics?.insights?.comparisonMetrics?.vsUserHistory || 0
  }

  const getTrendIcon = (value: number) => {
    if (value > 5) return <TrendingUp className="h-4 w-4 text-green-600" />
    if (value < -5) return <TrendingDown className="h-4 w-4 text-red-600" />
    return <Activity className="h-4 w-4 text-yellow-600" />
  }

  const getTrendColor = (value: number) => {
    if (value > 5) return 'text-green-600'
    if (value < -5) return 'text-red-600'
    return 'text-yellow-600'
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Application Analytics
          </div>
          {onViewAnalytics && (
            <Button variant="outline" size="sm" onClick={onViewAnalytics}>
              View Details
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Total Applications */}
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {stats.totalApplications}
            </div>
            <div className="text-xs text-muted-foreground">Total Applications</div>
            <div className="text-xs text-blue-600 mt-1">
              {stats.activeApplications} active
            </div>
          </div>

          {/* Success Rate */}
          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="flex items-center justify-center gap-1">
              <span className="text-2xl font-bold text-green-600">
                {Math.round(stats.successRate)}%
              </span>
              {getTrendIcon(stats.improvementTrend)}
            </div>
            <div className="text-xs text-muted-foreground">Success Rate</div>
            <div className={`text-xs mt-1 ${getTrendColor(stats.improvementTrend)}`}>
              {stats.improvementTrend > 0 ? '+' : ''}{Math.round(stats.improvementTrend)}% vs last period
            </div>
          </div>

          {/* Email Performance */}
          <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {Math.round(stats.emailOpenRate)}%
            </div>
            <div className="text-xs text-muted-foreground">Email Open Rate</div>
            <div className="text-xs text-purple-600 mt-1">
              {Math.round(stats.emailResponseRate)}% response
            </div>
          </div>

          {/* Engagement Score */}
          <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">
              {Math.round(stats.engagementScore)}
            </div>
            <div className="text-xs text-muted-foreground">Engagement Score</div>
            {stats.avgTimeToOffer > 0 && (
              <div className="text-xs text-orange-600 mt-1">
                {Math.round(stats.avgTimeToOffer)}d avg response
              </div>
            )}
          </div>
        </div>

        {/* Performance Indicators */}
        <div className="space-y-3">
          {/* Success Rate Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-green-600" />
                <span>Success Rate</span>
              </div>
              <span className="font-medium">{Math.round(stats.successRate)}%</span>
            </div>
            <Progress value={stats.successRate} className="h-2" />
            {stats.successRate < 15 && (
              <div className="text-xs text-muted-foreground">
                Below industry average (15%). Consider improving application quality.
              </div>
            )}
          </div>

          {/* Email Performance */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-600" />
                <span>Email Engagement</span>
              </div>
              <span className="font-medium">{Math.round(stats.emailOpenRate)}%</span>
            </div>
            <Progress value={stats.emailOpenRate} className="h-2" />
            {stats.emailOpenRate < 25 && (
              <div className="text-xs text-muted-foreground">
                Low open rate. Try improving subject lines and timing.
              </div>
            )}
          </div>

          {/* Response Time Indicator */}
          {stats.avgTimeToOffer > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-purple-600" />
                  <span>Avg Response Time</span>
                </div>
                <span className="font-medium">{Math.round(stats.avgTimeToOffer)} days</span>
              </div>
              <div className="flex items-center gap-1">
                {stats.avgTimeToOffer <= 7 && <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">Fast</Badge>}
                {stats.avgTimeToOffer > 7 && stats.avgTimeToOffer <= 14 && <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">Average</Badge>}
                {stats.avgTimeToOffer > 14 && <Badge variant="secondary" className="text-xs bg-red-100 text-red-800">Slow</Badge>}
              </div>
            </div>
          )}
        </div>

        {/* Quick Insights */}
        {analytics?.insights?.recommendations && analytics.insights.recommendations.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Zap className="h-4 w-4 text-yellow-500" />
              <span>Quick Insights</span>
            </div>
            <div className="space-y-1">
              {analytics.insights.recommendations.slice(0, 2).map((rec: any, index: number) => (
                <div key={index} className="p-2 bg-muted/30 rounded text-xs">
                  <span className="font-medium">{rec.type}:</span> {rec.suggestion}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status Breakdown */}
        {analytics?.insights?.statusBreakdown && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Application Status</div>
            <div className="grid grid-cols-2 gap-2">
              {analytics.insights.statusBreakdown
                .filter((status: any) => status.count > 0)
                .slice(0, 4)
                .map((status: any, index: number) => (
                <div key={index} className="flex items-center justify-between text-xs p-2 bg-muted/20 rounded">
                  <span className="capitalize">{status.status.replace('_', ' ')}</span>
                  <Badge variant="outline" className="text-xs">
                    {status.count}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}