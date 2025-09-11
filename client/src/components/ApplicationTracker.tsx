import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ApplicationPreparationModal } from '@/components/ApplicationPreparationModal'
import { Building2, Calendar, ExternalLink, Mail, MailOpen, Zap } from 'lucide-react'

interface Application {
  id: string
  jobTitle: string
  company: string
  appliedDate: string
  status: 'applied' | 'viewed' | 'interviewing' | 'offered' | 'rejected'
  matchScore: number
  emailOpened: boolean
  interviewDate?: string
  notes?: string
  preparationStatus?: 'pending' | 'preparing' | 'ready' | 'failed'
  coverLetter?: string
  tailoredCv?: string
  preparationMetadata?: any
  jobId: string
  userId: string
  job: {
    id: string
    title: string
    company: string
    description: string
    requirements: string[]
  }
}

interface ApplicationTrackerProps {
  applications: Application[]
  onViewDetails?: (applicationId: string) => void
}

export function ApplicationTracker({ applications, onViewDetails }: ApplicationTrackerProps) {
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null)
  const [isPreparationModalOpen, setIsPreparationModalOpen] = useState(false)
  const getStatusColor = (status: Application['status']) => {
    const colors = {
      applied: 'bg-blue-500',
      viewed: 'bg-yellow-500',
      interviewing: 'bg-purple-500',
      offered: 'bg-green-500',
      rejected: 'bg-gray-500'
    }
    return colors[status]
  }

  const getStatusText = (status: Application['status']) => {
    const labels = {
      applied: 'Applied',
      viewed: 'Under Review',
      interviewing: 'Interview',
      offered: 'Offered',
      rejected: 'Rejected'
    }
    return labels[status]
  }

  const handleViewDetails = (applicationId: string) => {
    console.log(`Viewing details for application: ${applicationId}`)
    onViewDetails?.(applicationId)
  }

  const handlePrepareApplication = (app: Application) => {
    setSelectedApplication(app)
    setIsPreparationModalOpen(true)
  }

  const getPreparationStatusBadge = (status?: 'pending' | 'preparing' | 'ready' | 'failed') => {
    if (!status || status === 'pending') return null
    
    switch (status) {
      case 'ready':
        return <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 ml-2">Ready</Badge>
      case 'preparing':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 ml-2">Preparing</Badge>
      case 'failed':
        return <Badge variant="destructive" className="ml-2">Failed</Badge>
      default:
        return null
    }
  }

  const stats = {
    total: applications.length,
    viewed: applications.filter(app => app.emailOpened).length,
    interviewing: applications.filter(app => app.status === 'interviewing').length,
    offered: applications.filter(app => app.status === 'offered').length
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-foreground" data-testid="stat-total-applications">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Applied</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary" data-testid="stat-viewed-applications">{stats.viewed}</div>
            <div className="text-sm text-muted-foreground">Emails Opened</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-accent-foreground" data-testid="stat-interview-applications">{stats.interviewing}</div>
            <div className="text-sm text-muted-foreground">Interviews</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600" data-testid="stat-offered-applications">{stats.offered}</div>
            <div className="text-sm text-muted-foreground">Offers</div>
          </CardContent>
        </Card>
      </div>

      {/* Applications List */}
      <div className="space-y-4">
        {applications.map((app) => (
          <Card key={app.id} className="transition-all duration-200 hover-elevate" data-testid={`application-card-${app.id}`}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-foreground mb-1" data-testid={`application-title-${app.id}`}>
                    {app.jobTitle}
                  </h3>
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <Building2 className="h-4 w-4" />
                    <span data-testid={`application-company-${app.id}`}>{app.company}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Applied {app.appliedDate}</span>
                    {app.emailOpened ? (
                      <div className="flex items-center gap-1 text-green-600">
                        <MailOpen className="h-4 w-4" />
                        <span>Email opened</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        <span>Email pending</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right space-y-2">
                  <div className="flex items-center justify-end gap-2">
                    <Badge 
                      className={`text-white ${getStatusColor(app.status)}`}
                      data-testid={`application-status-${app.id}`}
                    >
                      {getStatusText(app.status)}
                    </Badge>
                    {getPreparationStatusBadge(app.preparationStatus)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Match: <span className="font-medium" data-testid={`application-match-${app.id}`}>{app.matchScore}%</span>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Progress</span>
                  <span>{app.matchScore}% match</span>
                </div>
                <Progress value={app.matchScore} className="h-2" />
              </div>

              {/* Interview Date */}
              {app.interviewDate && (
                <div className="mb-4 p-3 bg-accent/10 rounded-lg">
                  <div className="flex items-center gap-2 text-sm font-medium text-accent-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Interview scheduled: {app.interviewDate}</span>
                  </div>
                </div>
              )}

              {/* Notes */}
              {app.notes && (
                <div className="mb-4">
                  <p className="text-sm text-muted-foreground" data-testid={`application-notes-${app.id}`}>
                    {app.notes}
                  </p>
                </div>
              )}

              {/* Actions */}
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
                  variant={app.preparationStatus === 'ready' ? "secondary" : "default"}
                  size="sm"
                  onClick={() => handlePrepareApplication(app)}
                  className="flex items-center gap-2"
                  data-testid={`button-prepare-application-${app.id}`}
                >
                  <Zap className="h-3 w-3" />
                  {app.preparationStatus === 'ready' ? 'View Preparation' : 
                   app.preparationStatus === 'preparing' ? 'Preparing...' : 
                   'Prepare Application'}
                </Button>
                {app.status === 'interviewing' && (
                  <Button
                    size="sm"
                    data-testid={`button-prep-interview-${app.id}`}
                  >
                    Prep Interview
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
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