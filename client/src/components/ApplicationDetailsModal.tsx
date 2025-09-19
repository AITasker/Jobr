import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/queryClient'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Building2, 
  Calendar, 
  Mail, 
  MailOpen, 
  MailCheck,
  TrendingUp,
  Clock,
  Eye,
  Download,
  Star,
  AlertCircle,
  CheckCircle,
  User,
  Zap,
  BarChart3,
  Activity as TimelineIcon,
  Send,
  Calendar as CalendarIcon,
  Target,
  Activity
} from 'lucide-react'

interface ApplicationDetailsModalProps {
  applicationId: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function ApplicationDetailsModal({ 
  applicationId, 
  isOpen, 
  onOpenChange 
}: ApplicationDetailsModalProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Fetch application details
  const { data: application, isLoading: applicationLoading } = useQuery({
    queryKey: ['application', applicationId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/applications/${applicationId}`);
      return await response.json();
    },
    enabled: isOpen && !!applicationId
  })

  // Fetch application timeline
  const { data: timeline, isLoading: timelineLoading } = useQuery({
    queryKey: ['application-timeline', applicationId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/applications/${applicationId}/timeline`);
      return await response.json();
    },
    enabled: isOpen && !!applicationId
  })

  // Fetch application insights
  const { data: insights, isLoading: insightsLoading } = useQuery({
    queryKey: ['application-insights', applicationId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/applications/${applicationId}/insights`);
      return await response.json();
    },
    enabled: isOpen && !!applicationId
  })

  // Fetch email analytics
  const { data: emailAnalytics, isLoading: emailLoading } = useQuery({
    queryKey: ['application-email-analytics', applicationId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/applications/${applicationId}/email/analytics`);
      return await response.json();
    },
    enabled: isOpen && !!applicationId
  })

  // Status update mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ newStatus, reason }: { newStatus: string; reason?: string }) => 
      apiRequest('PUT', `/api/applications/${applicationId}/status`, { newStatus, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['application', applicationId] })
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      toast({
        title: "Status Updated",
        description: "Application status has been updated successfully.",
      })
    }
  })

  // Interview scheduling mutation
  const scheduleInterviewMutation = useMutation({
    mutationFn: ({ interviewDate, interviewType }: { 
      interviewDate: string; 
      interviewType: string 
    }) => 
      apiRequest('POST', `/api/applications/${applicationId}/interview`, { interviewDate, interviewType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['application', applicationId] })
      toast({
        title: "Interview Scheduled",
        description: "Interview has been scheduled successfully.",
      })
    }
  })

  if (!isOpen) return null

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      applied: 'bg-blue-500',
      viewed: 'bg-yellow-500',
      interview_scheduled: 'bg-purple-500',
      interviewing: 'bg-purple-600',
      interview_completed: 'bg-indigo-500',
      offered: 'bg-green-500',
      accepted: 'bg-green-600',
      rejected: 'bg-red-500',
      withdrawn: 'bg-gray-500'
    }
    return colors[status] || 'bg-gray-400'
  }

  const getStatusText = (status: string) => {
    const labels: Record<string, string> = {
      applied: 'Applied',
      viewed: 'Under Review',
      interview_scheduled: 'Interview Scheduled',
      interviewing: 'Interviewing',
      interview_completed: 'Interview Complete',
      offered: 'Offered',
      accepted: 'Accepted',
      rejected: 'Rejected',
      withdrawn: 'Withdrawn'
    }
    return labels[status] || status
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange} data-testid="application-details-modal">
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Application Details
          </DialogTitle>
        </DialogHeader>

        {applicationLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : application ? (
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="grid w-full grid-cols-5" data-testid="application-tabs">
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="timeline" data-testid="tab-timeline">Timeline</TabsTrigger>
              <TabsTrigger value="insights" data-testid="tab-insights">Insights</TabsTrigger>
              <TabsTrigger value="email" data-testid="tab-email">Email Tracking</TabsTrigger>
              <TabsTrigger value="actions" data-testid="tab-actions">Actions</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold">{application.job?.title}</h2>
                      <p className="text-muted-foreground">{application.job?.company}</p>
                    </div>
                    <Badge 
                      className={`text-white ${getStatusColor(application.status)}`}
                      data-testid="application-current-status"
                    >
                      {getStatusText(application.status)}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-muted/30 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {application.matchScore}%
                      </div>
                      <div className="text-sm text-muted-foreground">Match Score</div>
                    </div>
                    
                    <div className="text-center p-3 bg-muted/30 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {application.employerInteractionScore || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">Engagement</div>
                    </div>
                    
                    <div className="text-center p-3 bg-muted/30 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">
                        {application.employerProfileViews || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">Profile Views</div>
                    </div>
                    
                    <div className="text-center p-3 bg-muted/30 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">
                        {application.applicationDownloads || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">Downloads</div>
                    </div>
                  </div>

                  {/* Application Progress */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Application Progress</span>
                      <span>{application.matchScore}% match</span>
                    </div>
                    <Progress value={application.matchScore} className="h-3" />
                  </div>

                  {/* Job Details */}
                  <div className="space-y-3">
                    <h3 className="font-semibold">Job Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm text-muted-foreground">Location:</span>
                        <p className="font-medium">{application.job?.location}</p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Job Type:</span>
                        <p className="font-medium">{application.job?.type}</p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Applied Date:</span>
                        <p className="font-medium">{formatDate(application.appliedDate)}</p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Last Updated:</span>
                        <p className="font-medium">{formatDate(application.updatedAt)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Interview Information */}
                  {application.interviewDate && (
                    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                      <div className="flex items-center gap-2 mb-2">
                        <CalendarIcon className="h-4 w-4 text-purple-600" />
                        <span className="font-semibold text-purple-700 dark:text-purple-300">
                          Interview Scheduled
                        </span>
                      </div>
                      <p className="text-sm">
                        {formatDate(application.interviewDate)}
                      </p>
                    </div>
                  )}

                  {/* Notes */}
                  {application.notes && (
                    <div className="space-y-2">
                      <h3 className="font-semibold">Notes</h3>
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-sm">{application.notes}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Timeline Tab */}
            <TabsContent value="timeline" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TimelineIcon className="h-5 w-5" />
                    Application Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {timelineLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    </div>
                  ) : timeline?.milestones ? (
                    <div className="space-y-4">
                      {timeline.milestones.map((milestone: any, index: number) => {
                        const getIcon = (type: string) => {
                          switch (type) {
                            case 'application':
                              return <Send className="h-4 w-4 text-blue-600" />
                            case 'email':
                              return <Mail className="h-4 w-4 text-green-600" />
                            case 'status_change':
                              return <Activity className="h-4 w-4 text-purple-600" />
                            case 'interaction':
                              return <User className="h-4 w-4 text-orange-600" />
                            default:
                              return <Clock className="h-4 w-4 text-gray-600" />
                          }
                        }

                        return (
                          <div key={index} className="flex gap-4 pb-4 border-b border-muted last:border-b-0">
                            <div className="flex-shrink-0 mt-1">
                              {getIcon(milestone.type)}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <h4 className="font-medium">{milestone.title}</h4>
                                <span className="text-xs text-muted-foreground">
                                  {formatDate(milestone.date)}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {milestone.description}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground">No timeline data available</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Insights Tab */}
            <TabsContent value="insights" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Application Insights
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {insightsLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    </div>
                  ) : insights ? (
                    <div className="space-y-4">
                      {/* Success Prediction */}
                      <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold">Success Prediction</span>
                          <div className="flex items-center gap-2">
                            <Star className="h-4 w-4 text-yellow-500" />
                            <span className="font-bold text-lg">
                              {Math.round(insights.successPrediction || 0)}%
                            </span>
                          </div>
                        </div>
                        <Progress value={insights.successPrediction || 0} className="h-2" />
                      </div>

                      {/* Engagement Score */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center p-3 bg-muted/30 rounded-lg">
                          <div className="text-xl font-bold text-green-600">
                            {insights.engagementScore || 0}
                          </div>
                          <div className="text-sm text-muted-foreground">Engagement Score</div>
                        </div>
                        
                        {insights.timeToResponse && (
                          <div className="text-center p-3 bg-muted/30 rounded-lg">
                            <div className="text-xl font-bold text-blue-600">
                              {insights.timeToResponse}d
                            </div>
                            <div className="text-sm text-muted-foreground">Response Time</div>
                          </div>
                        )}
                        
                        <div className="text-center p-3 bg-muted/30 rounded-lg">
                          <div className="text-xl font-bold text-purple-600">
                            {insights.recommendedActions?.length || 0}
                          </div>
                          <div className="text-sm text-muted-foreground">Recommendations</div>
                        </div>
                      </div>

                      {/* Recommendations */}
                      {insights.recommendedActions && insights.recommendedActions.length > 0 && (
                        <div className="space-y-3">
                          <h3 className="font-semibold">Recommendations</h3>
                          {insights.recommendedActions.map((action: any, index: number) => (
                            <div key={index} className="p-3 border rounded-lg">
                              <div className="flex items-start gap-2">
                                <Target className="h-4 w-4 mt-0.5 text-primary" />
                                <div>
                                  <p className="font-medium">{action.suggestedAction}</p>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {action.reason}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground">No insights available</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Email Tracking Tab */}
            <TabsContent value="email" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Email Analytics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {emailLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    </div>
                  ) : emailAnalytics?.analytics ? (
                    <div className="space-y-4">
                      {/* Email Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-muted/30 rounded-lg">
                          <div className="text-xl font-bold text-blue-600">
                            {emailAnalytics.analytics.totalSent}
                          </div>
                          <div className="text-sm text-muted-foreground">Sent</div>
                        </div>
                        
                        <div className="text-center p-3 bg-muted/30 rounded-lg">
                          <div className="text-xl font-bold text-green-600">
                            {emailAnalytics.analytics.totalOpened}
                          </div>
                          <div className="text-sm text-muted-foreground">Opened</div>
                        </div>
                        
                        <div className="text-center p-3 bg-muted/30 rounded-lg">
                          <div className="text-xl font-bold text-purple-600">
                            {emailAnalytics.analytics.totalClicked}
                          </div>
                          <div className="text-sm text-muted-foreground">Clicked</div>
                        </div>
                        
                        <div className="text-center p-3 bg-muted/30 rounded-lg">
                          <div className="text-xl font-bold text-orange-600">
                            {emailAnalytics.analytics.totalReplied}
                          </div>
                          <div className="text-sm text-muted-foreground">Replied</div>
                        </div>
                      </div>

                      {/* Email Rates */}
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Open Rate</span>
                            <span>{Math.round(emailAnalytics.analytics.openRate)}%</span>
                          </div>
                          <Progress value={emailAnalytics.analytics.openRate} className="h-2" />
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Click Rate</span>
                            <span>{Math.round(emailAnalytics.analytics.clickRate)}%</span>
                          </div>
                          <Progress value={emailAnalytics.analytics.clickRate} className="h-2" />
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Response Rate</span>
                            <span>{Math.round(emailAnalytics.analytics.responseRate)}%</span>
                          </div>
                          <Progress value={emailAnalytics.analytics.responseRate} className="h-2" />
                        </div>
                      </div>

                      {/* Recent Events */}
                      {emailAnalytics.analytics.events && emailAnalytics.analytics.events.length > 0 && (
                        <div className="space-y-2">
                          <h3 className="font-semibold">Recent Email Events</h3>
                          <div className="space-y-2">
                            {emailAnalytics.analytics.events.slice(0, 5).map((event: any, index: number) => (
                              <div key={index} className="flex items-center justify-between p-2 border rounded">
                                <div className="flex items-center gap-2">
                                  {event.eventType === 'sent' && <Send className="h-4 w-4 text-blue-600" />}
                                  {event.eventType === 'open' && <MailOpen className="h-4 w-4 text-green-600" />}
                                  {event.eventType === 'click' && <Eye className="h-4 w-4 text-purple-600" />}
                                  {event.eventType === 'replied' && <MailCheck className="h-4 w-4 text-orange-600" />}
                                  <span className="text-sm font-medium capitalize">
                                    {event.eventType}
                                  </span>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {formatDate(event.timestamp)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground">No email analytics available</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Actions Tab */}
            <TabsContent value="actions" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Status Update Section */}
                  <div className="space-y-2">
                    <h3 className="font-semibold">Update Status</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        onClick={() => updateStatusMutation.mutate({ newStatus: 'interview_scheduled' })}
                        disabled={updateStatusMutation.isPending}
                        className="flex items-center gap-2"
                      >
                        <CalendarIcon className="h-4 w-4" />
                        Schedule Interview
                      </Button>
                      
                      <Button
                        variant="outline"
                        onClick={() => updateStatusMutation.mutate({ newStatus: 'offered' })}
                        disabled={updateStatusMutation.isPending}
                        className="flex items-center gap-2"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Mark as Offered
                      </Button>
                      
                      <Button
                        variant="outline"
                        onClick={() => updateStatusMutation.mutate({ newStatus: 'rejected' })}
                        disabled={updateStatusMutation.isPending}
                        className="flex items-center gap-2"
                      >
                        <AlertCircle className="h-4 w-4" />
                        Mark as Rejected
                      </Button>
                      
                      <Button
                        variant="outline"
                        onClick={() => updateStatusMutation.mutate({ newStatus: 'withdrawn' })}
                        disabled={updateStatusMutation.isPending}
                        className="flex items-center gap-2"
                      >
                        <AlertCircle className="h-4 w-4" />
                        Withdraw
                      </Button>
                    </div>
                  </div>

                  {/* Communication Actions */}
                  <div className="space-y-2">
                    <h3 className="font-semibold">Communication</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" className="flex items-center gap-2">
                        <Send className="h-4 w-4" />
                        Send Follow-up
                      </Button>
                      
                      <Button variant="outline" className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Send Thank You
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p className="text-muted-foreground">Failed to load application details</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}