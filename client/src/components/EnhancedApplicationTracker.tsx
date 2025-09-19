import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/queryClient'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Checkbox } from '@/components/ui/checkbox'
import { ApplicationPreparationModal } from '@/components/ApplicationPreparationModal'
import { 
  Building2, 
  Calendar, 
  ExternalLink, 
  Mail, 
  MailOpen, 
  MailCheck,
  MailX,
  Zap, 
  Edit,
  Eye,
  Clock,
  TrendingUp,
  Users,
  Target,
  Filter,
  Search,
  MoreHorizontal,
  Star,
  AlertCircle,
  CheckCircle,
  XCircle,
  Calendar as CalendarIcon,
  Activity,
  BarChart3,
  Send
} from 'lucide-react'

// Enhanced Application interface matching the comprehensive schema
interface Application {
  id: string
  userId: string
  jobId: string
  status: 'applied' | 'viewed' | 'interview_scheduled' | 'interviewing' | 'interview_completed' | 'offered' | 'rejected' | 'withdrawn' | 'accepted'
  matchScore: number
  tailoredCv?: string
  coverLetter?: string
  preparationStatus?: 'pending' | 'preparing' | 'ready' | 'failed'
  preparationMetadata?: any
  
  // Email tracking fields
  emailSentAt?: string
  emailOpened?: boolean
  emailOpenedAt?: string
  emailRepliedAt?: string
  lastEmailInteractionAt?: string
  
  // Application timeline fields
  appliedDate: string
  viewedByEmployerAt?: string
  interviewScheduledAt?: string
  interviewDate?: string
  interviewCompletedAt?: string
  offerReceivedAt?: string
  rejectedAt?: string
  withdrawnAt?: string
  lastStatusChangeAt?: string
  
  // Follow-up and engagement fields
  nextFollowUpDate?: string
  followUpReminderSent?: boolean
  autoFollowUpEnabled?: boolean
  employerProfileViews?: number
  applicationDownloads?: number
  employerInteractionScore?: number
  
  // Metadata fields
  applicationSource?: string
  priority?: 'low' | 'medium' | 'high'
  notes?: string
  internalNotes?: string
  tags?: string[]
  
  // Timestamps
  createdAt: string
  updatedAt: string
  
  // Related job data
  job: {
    id: string
    title: string
    company: string
    location: string
    type: string
    salary?: string
    description?: string
    requirements?: string
    postedDate?: string
    isActive: boolean
  }
}

interface ApplicationTrackerProps {
  onViewDetails?: (applicationId: string) => void
  onEditApplication?: (application: Application) => void
}

export function EnhancedApplicationTracker({ onViewDetails, onEditApplication }: ApplicationTrackerProps) {
  // State management
  const [selectedApplications, setSelectedApplications] = useState<string[]>([])
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null)
  const [isPreparationModalOpen, setIsPreparationModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('appliedDate')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showFilters, setShowFilters] = useState(false)

  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Fetch applications with enhanced data
  const { data: applications = [], isLoading, error } = useQuery({
    queryKey: ['applications'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/applications');
      return await response.json();
    }
  })

  // Fetch comprehensive analytics
  const { data: analytics } = useQuery({
    queryKey: ['applications-analytics'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/applications/analytics');
      return await response.json();
    }
  })

  // Fetch user notifications
  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/notifications?limit=5');
      return await response.json();
    }
  })

  // Mutation for updating application status
  const updateStatusMutation = useMutation({
    mutationFn: ({ applicationId, newStatus, reason }: { 
      applicationId: string; 
      newStatus: string; 
      reason?: string 
    }) => 
      apiRequest('PUT', `/api/applications/${applicationId}/status`, { newStatus, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      queryClient.invalidateQueries({ queryKey: ['applications-analytics'] })
      toast({
        title: "Status Updated",
        description: "Application status has been updated successfully.",
      })
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update application status.",
        variant: "destructive",
      })
    }
  })

  // Mutation for bulk operations
  const bulkUpdateMutation = useMutation({
    mutationFn: ({ applicationIds, updates, reason }: { 
      applicationIds: string[]; 
      updates: any; 
      reason: string 
    }) => 
      apiRequest('POST', '/api/applications/bulk-update', { applicationIds, updates, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      setSelectedApplications([])
      toast({
        title: "Bulk Update Complete",
        description: "Selected applications have been updated.",
      })
    }
  })

  // Filter and sort applications
  const filteredAndSortedApplications = applications
    .filter((app: Application) => {
      // Search filter
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase()
        if (
          !app.job.title.toLowerCase().includes(searchLower) &&
          !app.job.company.toLowerCase().includes(searchLower) &&
          !app.notes?.toLowerCase().includes(searchLower)
        ) {
          return false
        }
      }
      
      // Status filter
      if (statusFilter !== 'all' && app.status !== statusFilter) {
        return false
      }
      
      return true
    })
    .sort((a: Application, b: Application) => {
      let aValue, bValue
      
      switch (sortBy) {
        case 'appliedDate':
          aValue = new Date(a.appliedDate).getTime()
          bValue = new Date(b.appliedDate).getTime()
          break
        case 'matchScore':
          aValue = a.matchScore
          bValue = b.matchScore
          break
        case 'company':
          aValue = a.job.company.toLowerCase()
          bValue = b.job.company.toLowerCase()
          break
        case 'status':
          aValue = a.status
          bValue = b.status
          break
        case 'interactionScore':
          aValue = a.employerInteractionScore || 0
          bValue = b.employerInteractionScore || 0
          break
        default:
          aValue = a.appliedDate
          bValue = b.appliedDate
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

  // Enhanced status color and text functions
  const getStatusColor = (status: Application['status']) => {
    const colors = {
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

  const getStatusText = (status: Application['status']) => {
    const labels = {
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

  const getEmailStatusIcon = (app: Application) => {
    if (app.emailRepliedAt) {
      return <MailCheck className="h-4 w-4 text-green-600" />
    } else if (app.emailOpened) {
      return <MailOpen className="h-4 w-4 text-blue-600" />
    } else if (app.emailSentAt) {
      return <Mail className="h-4 w-4 text-gray-600" />
    } else {
      return <MailX className="h-4 w-4 text-gray-400" />
    }
  }

  const getInteractionScore = (app: Application) => {
    const score = app.employerInteractionScore || 0
    if (score >= 75) return { color: 'text-green-600', level: 'High' }
    if (score >= 40) return { color: 'text-yellow-600', level: 'Medium' }
    return { color: 'text-gray-600', level: 'Low' }
  }

  // Enhanced statistics
  const enhancedStats = {
    total: applications.length,
    active: applications.filter((app: Application) => 
      !['rejected', 'withdrawn', 'accepted'].includes(app.status)
    ).length,
    emailOpened: applications.filter((app: Application) => app.emailOpened).length,
    interviewing: applications.filter((app: Application) => 
      ['interview_scheduled', 'interviewing', 'interview_completed'].includes(app.status)
    ).length,
    offered: applications.filter((app: Application) => 
      ['offered', 'accepted'].includes(app.status)
    ).length,
    successRate: applications.length > 0 ? 
      (applications.filter((app: Application) => ['offered', 'accepted'].includes(app.status)).length / applications.length * 100).toFixed(1)
      : '0'
  }

  const handleViewDetails = (applicationId: string) => {
    onViewDetails?.(applicationId)
  }

  const handlePrepareApplication = (app: Application) => {
    setSelectedApplication(app)
    setIsPreparationModalOpen(true)
  }

  const handleStatusUpdate = (applicationId: string, newStatus: string, reason?: string) => {
    updateStatusMutation.mutate({ applicationId, newStatus, reason })
  }

  const handleBulkAction = (action: string) => {
    if (selectedApplications.length === 0) return
    
    const updates = { status: action }
    const reason = `Bulk ${action} action`
    
    bulkUpdateMutation.mutate({
      applicationIds: selectedApplications,
      updates,
      reason
    })
  }

  const handleSelectApplication = (applicationId: string, checked: boolean) => {
    setSelectedApplications(prev => 
      checked 
        ? [...prev, applicationId]
        : prev.filter(id => id !== applicationId)
    )
  }

  const handleSelectAll = (checked: boolean) => {
    setSelectedApplications(
      checked ? filteredAndSortedApplications.map((app: Application) => app.id) : []
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-muted-foreground">Loading applications...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-muted-foreground">Failed to load applications</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-foreground" data-testid="stat-total-applications">
              {enhancedStats.total}
            </div>
            <div className="text-sm text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600" data-testid="stat-active-applications">
              {enhancedStats.active}
            </div>
            <div className="text-sm text-muted-foreground">Active</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600" data-testid="stat-email-opened">
              {enhancedStats.emailOpened}
            </div>
            <div className="text-sm text-muted-foreground">Viewed</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600" data-testid="stat-interviews">
              {enhancedStats.interviewing}
            </div>
            <div className="text-sm text-muted-foreground">Interviews</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600" data-testid="stat-offers">
              {enhancedStats.offered}
            </div>
            <div className="text-sm text-muted-foreground">Offers</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-accent-foreground" data-testid="stat-success-rate">
              {enhancedStats.successRate}%
            </div>
            <div className="text-sm text-muted-foreground">Success Rate</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex-1 flex gap-2 items-center">
              <div className="relative flex-1">
                <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search applications by company, role, or notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-applications"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2"
                data-testid="button-toggle-filters"
              >
                <Filter className="h-4 w-4" />
                Filters
              </Button>
            </div>
            
            <div className="flex gap-2">
              {selectedApplications.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-2">
                      Actions ({selectedApplications.length})
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleBulkAction('withdrawn')}>
                      Withdraw Selected
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkAction('rejected')}>
                      Mark as Rejected
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setSelectedApplications([])}>
                      Clear Selection
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
          
          {/* Advanced Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-4 gap-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="applied">Applied</SelectItem>
                  <SelectItem value="viewed">Under Review</SelectItem>
                  <SelectItem value="interview_scheduled">Interview Scheduled</SelectItem>
                  <SelectItem value="interviewing">Interviewing</SelectItem>
                  <SelectItem value="offered">Offered</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="appliedDate">Applied Date</SelectItem>
                  <SelectItem value="matchScore">Match Score</SelectItem>
                  <SelectItem value="company">Company</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="interactionScore">Interaction Score</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={sortOrder} onValueChange={(value: 'asc' | 'desc') => setSortOrder(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort order" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Descending</SelectItem>
                  <SelectItem value="asc">Ascending</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="select-all"
                  checked={selectedApplications.length === filteredAndSortedApplications.length && filteredAndSortedApplications.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <label htmlFor="select-all" className="text-sm font-medium">
                  Select All ({filteredAndSortedApplications.length})
                </label>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Applications List */}
      <div className="space-y-4">
        {filteredAndSortedApplications.map((app: Application) => {
          const interactionScore = getInteractionScore(app)
          const isSelected = selectedApplications.includes(app.id)
          
          return (
            <Card 
              key={app.id} 
              className={`transition-all duration-200 hover-elevate ${isSelected ? 'ring-2 ring-primary' : ''}`}
              data-testid={`application-card-${app.id}`}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  {/* Selection Checkbox */}
                  <div className="flex items-start pt-1">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => handleSelectApplication(app.id, checked as boolean)}
                      data-testid={`checkbox-select-${app.id}`}
                    />
                  </div>
                  
                  {/* Main Content */}
                  <div className="flex-1 space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-foreground mb-1" data-testid={`application-title-${app.id}`}>
                          {app.job.title}
                        </h3>
                        <div className="flex items-center gap-4 text-muted-foreground mb-2">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            <span data-testid={`application-company-${app.id}`}>{app.job.company}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>{new Date(app.appliedDate).toLocaleDateString()}</span>
                          </div>
                          {getEmailStatusIcon(app)}
                        </div>
                        
                        {/* Enhanced metadata row */}
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            <span>Match: {app.matchScore}%</span>
                          </div>
                          <div className={`flex items-center gap-1 ${interactionScore.color}`}>
                            <TrendingUp className="h-3 w-3" />
                            <span>{interactionScore.level} Engagement</span>
                          </div>
                          {app.employerProfileViews && (
                            <div className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              <span>{app.employerProfileViews} views</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Status and Actions */}
                      <div className="text-right space-y-2">
                        <div className="flex items-center justify-end gap-2">
                          <Badge 
                            className={`text-white ${getStatusColor(app.status)}`}
                            data-testid={`application-status-${app.id}`}
                          >
                            {getStatusText(app.status)}
                          </Badge>
                          {app.priority === 'high' && (
                            <Badge variant="outline" className="border-red-500 text-red-600">
                              <Star className="h-3 w-3 mr-1" />
                              Priority
                            </Badge>
                          )}
                        </div>
                        
                        {/* Quick Actions Menu */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleViewDetails(app.id)}>
                              <Activity className="h-4 w-4 mr-2" />
                              View Timeline
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleViewDetails(app.id)}>
                              <BarChart3 className="h-4 w-4 mr-2" />
                              View Insights
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleStatusUpdate(app.id, 'interview_scheduled')}>
                              <CalendarIcon className="h-4 w-4 mr-2" />
                              Schedule Interview
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusUpdate(app.id, 'withdrawn')}>
                              <XCircle className="h-4 w-4 mr-2" />
                              Withdraw
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Enhanced Progress Section */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Application Progress</span>
                        <span>{app.matchScore}% match • {app.employerInteractionScore || 0} engagement</span>
                      </div>
                      <Progress value={app.matchScore} className="h-2" />
                    </div>

                    {/* Interview Information */}
                    {app.interviewDate && (
                      <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                        <div className="flex items-center gap-2 text-sm font-medium text-purple-700 dark:text-purple-300">
                          <CalendarIcon className="h-4 w-4" />
                          <span>Interview: {new Date(app.interviewDate).toLocaleDateString()} at {new Date(app.interviewDate).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {app.notes && (
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-sm text-muted-foreground" data-testid={`application-notes-${app.id}`}>
                          {app.notes}
                        </p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDetails(app.id)}
                        className="flex items-center gap-2"
                        data-testid={`button-view-details-${app.id}`}
                      >
                        <ExternalLink className="h-3 w-3" />
                        View Details
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEditApplication?.(app)}
                        className="flex items-center gap-2"
                        data-testid={`button-edit-application-${app.id}`}
                      >
                        <Edit className="h-3 w-3" />
                        Edit
                      </Button>
                      
                      <Button
                        variant={app.preparationStatus === 'ready' ? "secondary" : "default"}
                        size="sm"
                        onClick={() => handlePrepareApplication(app)}
                        className="flex items-center gap-2"
                        data-testid={`button-prepare-application-${app.id}`}
                      >
                        <Zap className="h-3 w-3" />
                        {app.preparationStatus === 'ready' ? 'View Materials' : 
                         app.preparationStatus === 'preparing' ? 'Preparing...' : 
                         'Prepare Application'}
                      </Button>
                      
                      {app.emailSentAt && !app.emailRepliedAt && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2 text-blue-600"
                        >
                          <Send className="h-3 w-3" />
                          Send Follow-up
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}

        {filteredAndSortedApplications.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="text-muted-foreground">
                {searchQuery || statusFilter !== 'all' 
                  ? "No applications match your current filters." 
                  : "No applications found. Start by adding your first application!"}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Application Preparation Modal */}
      {selectedApplication && (
        <ApplicationPreparationModal
          application={selectedApplication}
          isOpen={isPreparationModalOpen}
          onOpenChange={setIsPreparationModalOpen}
        />
      )}
    </div>
  )
}