import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MapPin, Clock, DollarSign, Building2, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { apiRequest, queryClient } from '@/lib/queryClient'
import { useToast } from '@/hooks/use-toast'
import { useState } from 'react'

interface JobMatchResult {
  job: {
    id: string
    title: string
    company: string
    location: string
    type: string
    salary?: string
    postedDate: string
    description: string
    requirements: string[]
  }
  matchScore: number
  explanation: string
  skillsMatch: {
    matched: string[]
    missing: string[]
    score: number
  }
  experienceMatch: {
    suitable: boolean
    explanation: string
    score: number
  }
  locationMatch: {
    suitable: boolean
    explanation: string
    score: number
  }
  salaryMatch: {
    suitable: boolean
    explanation: string
    score: number
  }
}

interface JobCardProps {
  jobMatch: JobMatchResult
  onApply?: (jobId: string, matchScore: number) => void
  onSave?: (jobId: string) => void
}

export function JobCard({ jobMatch, onApply, onSave }: JobCardProps) {
  const { job, matchScore, explanation, skillsMatch, experienceMatch, locationMatch, salaryMatch } = jobMatch
  const { toast } = useToast()
  const [showDetails, setShowDetails] = useState(false)
  const [isApplying, setIsApplying] = useState(false)

  const applyMutation = useMutation({
    mutationFn: async ({ jobId, matchScore }: { jobId: string; matchScore: number }) => {
      const response = await apiRequest('POST', `/api/jobs/${jobId}/apply`, { matchScore })
      return response.json()
    },
    onSuccess: (data) => {
      toast({
        title: 'Application Submitted!',
        description: data.message || `Successfully applied to ${job.title}`,
      })
      onApply?.(job.id, matchScore)
      queryClient.invalidateQueries({ queryKey: ['/api/applications'] })
    },
    onError: (error: Error) => {
      toast({
        title: 'Application Failed',
        description: error.message || 'Failed to submit application',
        variant: 'destructive',
      })
    }
  })

  const handleApply = () => {
    setIsApplying(true)
    applyMutation.mutate({ jobId: job.id, matchScore })
  }

  const handleSave = () => {
    console.log(`Saving job: ${job.title}`)
    onSave?.(job.id)
    toast({
      title: 'Job Saved',
      description: `${job.title} has been saved to your list`,
    })
  }

  const getMatchColor = (score: number) => {
    if (score >= 85) return 'bg-green-500'
    if (score >= 70) return 'bg-yellow-500'
    return 'bg-orange-500'
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      const now = new Date()
      const diffTime = Math.abs(now.getTime() - date.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      
      if (diffDays === 1) return '1 day ago'
      if (diffDays < 7) return `${diffDays} days ago`
      if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`
      return date.toLocaleDateString()
    } catch {
      return dateString
    }
  }

  const getCompatibilityIcon = (suitable: boolean | undefined, score: number) => {
    if (score >= 80) return <CheckCircle className="h-4 w-4 text-green-600" />
    if (score >= 60) return <AlertCircle className="h-4 w-4 text-yellow-600" />
    return <XCircle className="h-4 w-4 text-red-600" />
  }

  return (
    <Card className="h-full transition-all duration-200 hover-elevate" data-testid={`card-job-${job.id}`}>
      <CardContent className="p-6">
        {/* Header with Match Score */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground mb-1" data-testid={`job-title-${job.id}`}>
              {job.title}
            </h3>
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Building2 className="h-4 w-4" />
              <span data-testid={`job-company-${job.id}`}>{job.company}</span>
            </div>
          </div>
          <div className="text-right">
            <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium text-white ${getMatchColor(matchScore)} mb-1`}>
              <span data-testid={`match-score-${job.id}`}>{matchScore}%</span>
            </div>
            <p className="text-xs text-muted-foreground">Match Score</p>
          </div>
        </div>

        {/* Match Explanation */}
        <div className="mb-4 p-3 bg-muted/50 rounded-md">
          <p className="text-sm text-foreground" data-testid={`match-explanation-${job.id}`}>
            {explanation}
          </p>
        </div>

        {/* Job Details */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span data-testid={`job-location-${job.id}`}>{job.location}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span data-testid={`job-posted-${job.id}`}>{formatDate(job.postedDate)}</span>
          </div>
          <Badge variant="secondary" className="w-fit" data-testid={`job-type-${job.id}`}>
            {job.type}
          </Badge>
          {job.salary && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              <span data-testid={`job-salary-${job.id}`}>{job.salary}</span>
            </div>
          )}
        </div>

        {/* Skills Match */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-foreground">Skills Match ({skillsMatch.score}%)</h4>
            {getCompatibilityIcon(skillsMatch.matched.length > 0, skillsMatch.score)}
          </div>
          <div className="space-y-2">
            {skillsMatch.matched.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">You have:</p>
                <div className="flex flex-wrap gap-1">
                  {skillsMatch.matched.slice(0, 4).map((skill, index) => (
                    <Badge key={index} variant="default" className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                      ✓ {skill}
                    </Badge>
                  ))}
                  {skillsMatch.matched.length > 4 && (
                    <Badge variant="outline" className="text-xs">
                      +{skillsMatch.matched.length - 4} more
                    </Badge>
                  )}
                </div>
              </div>
            )}
            {skillsMatch.missing.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Could improve:</p>
                <div className="flex flex-wrap gap-1">
                  {skillsMatch.missing.slice(0, 3).map((skill, index) => (
                    <Badge key={index} variant="outline" className="text-xs text-orange-600 border-orange-200">
                      {skill}
                    </Badge>
                  ))}
                  {skillsMatch.missing.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{skillsMatch.missing.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Compatibility Summary */}
        <div className="mb-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowDetails(!showDetails)}
            className="h-auto p-2 w-full justify-between text-left"
            data-testid={`toggle-details-${job.id}`}
          >
            <span className="text-sm font-medium">Compatibility Details</span>
            <span className="text-xs">{showDetails ? '−' : '+'}</span>
          </Button>
          
          {showDetails && (
            <div className="mt-2 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {getCompatibilityIcon(experienceMatch.suitable, experienceMatch.score)}
                  Experience
                </span>
                <span className="text-muted-foreground">{experienceMatch.score}%</span>
              </div>
              <p className="text-xs text-muted-foreground ml-6">{experienceMatch.explanation}</p>
              
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {getCompatibilityIcon(locationMatch.suitable, locationMatch.score)}
                  Location
                </span>
                <span className="text-muted-foreground">{locationMatch.score}%</span>
              </div>
              <p className="text-xs text-muted-foreground ml-6">{locationMatch.explanation}</p>
              
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {getCompatibilityIcon(salaryMatch.suitable, salaryMatch.score)}
                  Compensation
                </span>
                <span className="text-muted-foreground">{salaryMatch.score}%</span>
              </div>
              <p className="text-xs text-muted-foreground ml-6">{salaryMatch.explanation}</p>
            </div>
          )}
        </div>

        {/* Description Preview */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-foreground mb-2">About the Role</h4>
          <p className="text-sm text-muted-foreground line-clamp-3" data-testid={`job-description-${job.id}`}>
            {job.description}
          </p>
        </div>
      </CardContent>

      <CardFooter className="flex gap-2 p-6 pt-0">
        <Button 
          className="flex-1" 
          onClick={handleApply} 
          disabled={applyMutation.isPending}
          data-testid={`button-apply-${job.id}`}
        >
          {applyMutation.isPending ? 'Applying...' : 'Apply Now'}
        </Button>
        <Button variant="outline" onClick={handleSave} data-testid={`button-save-${job.id}`}>
          Save
        </Button>
      </CardFooter>
    </Card>
  )
}