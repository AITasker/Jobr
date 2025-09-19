import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { MapPin, Clock, DollarSign, Building2, CheckCircle, XCircle, AlertCircle, Bookmark, BookmarkCheck, ChevronDown, ChevronUp, TrendingUp, Target, Users, Star, ArrowRight, Loader2, Scale } from 'lucide-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { apiRequest, queryClient } from '@/lib/queryClient'
import { useToast } from '@/hooks/use-toast'
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

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
  isBookmarked?: boolean
  showDetailedAnalysis?: boolean
  onAddToComparison?: () => void
  isInComparison?: boolean
}

export function JobCard({ 
  jobMatch, 
  onApply, 
  onSave, 
  isBookmarked = false, 
  showDetailedAnalysis = true,
  onAddToComparison,
  isInComparison = false 
}: JobCardProps) {
  const { job, matchScore, explanation, skillsMatch, experienceMatch, locationMatch, salaryMatch } = jobMatch
  const { toast } = useToast()
  const { user } = useAuth()
  const [showDetails, setShowDetails] = useState(false)
  const [isBookmarkHovered, setIsBookmarkHovered] = useState(false)

  // Check if job is bookmarked
  const { data: bookmarkStatus } = useQuery({
    queryKey: ['/api/bookmarks/check', job.id],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/bookmarks/check?jobId=${job.id}`)
      return response.json()
    },
    enabled: !!user?.id,
    retry: false
  })

  const isJobBookmarked = isBookmarked || bookmarkStatus?.isBookmarked

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
    },
    onSettled: () => {
      // Reset any UI state and ensure cache is properly invalidated
      queryClient.invalidateQueries({ queryKey: ['/api/applications'] })
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] })
    }
  })

  // Bookmark mutation
  const bookmarkMutation = useMutation({
    mutationFn: async () => {
      if (isJobBookmarked) {
        return apiRequest('DELETE', `/api/bookmarks/${job.id}`)
      } else {
        return apiRequest('POST', '/api/bookmarks', { jobId: job.id })
      }
    },
    onSuccess: () => {
      toast({
        title: isJobBookmarked ? 'Bookmark Removed' : 'Job Bookmarked',
        description: isJobBookmarked ? `Removed ${job.title} from bookmarks` : `${job.title} has been bookmarked`,
      })
      queryClient.invalidateQueries({ queryKey: ['/api/bookmarks'] })
      queryClient.invalidateQueries({ queryKey: ['/api/bookmarks/check', job.id] })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update bookmark',
        variant: 'destructive',
      })
    },
    onSettled: () => {
      // Ensure bookmark status is refreshed
      queryClient.invalidateQueries({ queryKey: ['/api/bookmarks'] })
      queryClient.invalidateQueries({ queryKey: ['/api/bookmarks/check', job.id] })
    }
  })

  const handleApply = () => {
    applyMutation.mutate({ jobId: job.id, matchScore })
  }

  const handleBookmark = () => {
    bookmarkMutation.mutate()
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

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'from-green-500 to-green-600'
    if (score >= 70) return 'from-blue-500 to-blue-600'
    if (score >= 55) return 'from-yellow-500 to-yellow-600'
    return 'from-orange-500 to-red-500'
  }

  const getScoreDescription = (score: number) => {
    if (score >= 85) return 'Excellent Match'
    if (score >= 70) return 'Great Match'
    if (score >= 55) return 'Good Match'
    return 'Moderate Match'
  }

  const getSalaryInsight = () => {
    if (job.salary && salaryMatch.suitable) {
      return `This salary range aligns well with your experience level and market standards.`
    }
    return 'Salary information not available for comparison.'
  }

  const getCareerProgressionInsight = () => {
    if (experienceMatch.suitable && experienceMatch.score >= 75) {
      return 'This role offers strong career progression opportunities based on your background.'
    }
    if (experienceMatch.score >= 50) {
      return 'This position could be a strategic career move with some skill development.'
    }
    return 'Consider if this role aligns with your long-term career goals.'
  }

  return (
    <Card className="h-full transition-all duration-200 hover-elevate border-l-4 border-l-transparent hover:border-l-blue-500" data-testid={`card-job-${job.id}`}>
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

        {/* Enhanced Match Score Visualization */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-foreground">Match Analysis</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
              className="h-6 px-2 text-xs"
              data-testid={`button-toggle-details-${job.id}`}
            >
              {showDetails ? 'Hide Details' : 'Show Details'}
              {showDetails ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />}
            </Button>
          </div>
          
          {/* Overall Score Bar */}
          <div className="mb-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-muted-foreground">Overall Match</span>
              <span className="text-xs font-medium">{matchScore}%</span>
            </div>
            <div className={`h-2 bg-gradient-to-r ${getScoreColor(matchScore)} rounded-full relative overflow-hidden`}>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{getScoreDescription(matchScore)}</p>
          </div>

          {/* Skills Match Summary */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-600" />
                <span className="text-xs font-medium">{skillsMatch.matched.length} Skills Match</span>
              </div>
              <Progress value={skillsMatch.score} className="h-1" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Target className="h-3 w-3 text-orange-600" />
                <span className="text-xs font-medium">{skillsMatch.missing.length} to Learn</span>
              </div>
              <Progress value={Math.max(0, 100 - (skillsMatch.missing.length * 10))} className="h-1" />
            </div>
          </div>

          <Collapsible open={showDetails} onOpenChange={setShowDetails}>
            <CollapsibleContent className="space-y-4">
              {/* Detailed Skills Analysis */}
              <div>
                <h5 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  Skills Analysis
                </h5>
                
                {skillsMatch.matched.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-muted-foreground mb-2">✅ Skills you have ({skillsMatch.matched.length}):</p>
                    <div className="flex flex-wrap gap-1">
                      {skillsMatch.matched.map((skill, index) => (
                        <Badge key={index} variant="default" className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {skillsMatch.missing.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-muted-foreground mb-2">🎯 Skills to develop ({skillsMatch.missing.length}):</p>
                    <div className="flex flex-wrap gap-1">
                      {skillsMatch.missing.map((skill, index) => (
                        <Badge key={index} variant="secondary" className="text-xs bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">💡 Consider online courses or certifications in these areas</p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Career Progression Insights */}
              <div>
                <h5 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Career Insights
                </h5>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <ArrowRight className="h-3 w-3 mt-0.5 text-blue-500" />
                    <p className="text-xs text-muted-foreground">{getCareerProgressionInsight()}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <DollarSign className="h-3 w-3 mt-0.5 text-green-500" />
                    <p className="text-xs text-muted-foreground">{getSalaryInsight()}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Detailed Match Breakdown */}
              <div>
                <h5 className="text-sm font-medium text-foreground mb-2">Match Breakdown</h5>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Experience</span>
                      <div className="flex items-center gap-1">
                        {getCompatibilityIcon(experienceMatch.suitable, experienceMatch.score)}
                        <span className="text-xs font-medium">{experienceMatch.score}%</span>
                      </div>
                    </div>
                    <Progress value={experienceMatch.score} className="h-1" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Location</span>
                      <div className="flex items-center gap-1">
                        {getCompatibilityIcon(locationMatch.suitable, locationMatch.score)}
                        <span className="text-xs font-medium">{locationMatch.score}%</span>
                      </div>
                    </div>
                    <Progress value={locationMatch.score} className="h-1" />
                  </div>
                </div>
                
                {experienceMatch.explanation && (
                  <p className="text-xs text-muted-foreground mt-2">
                    📊 {experienceMatch.explanation}
                  </p>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Description Preview */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-foreground mb-2">About the Role</h4>
          <p className="text-sm text-muted-foreground line-clamp-3" data-testid={`job-description-${job.id}`}>
            {job.description}
          </p>
        </div>
      </CardContent>

      <CardFooter className="px-6 py-4 bg-muted/30 flex justify-between items-center">
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleBookmark}
            disabled={bookmarkMutation.isPending}
            onMouseEnter={() => setIsBookmarkHovered(true)}
            onMouseLeave={() => setIsBookmarkHovered(false)}
            className={`transition-colors ${
              isJobBookmarked 
                ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300' 
                : ''
            }`}
            data-testid={`button-bookmark-${job.id}`}
          >
            {isJobBookmarked ? (
              <>
                <BookmarkCheck className="mr-2 h-4 w-4" />
                {isBookmarkHovered ? 'Remove' : 'Saved'}
              </>
            ) : (
              <>
                <Bookmark className="mr-2 h-4 w-4" />
                {bookmarkMutation.isPending ? 'Saving...' : 'Save'}
              </>
            )}
          </Button>
          {onAddToComparison && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onAddToComparison}
              disabled={isInComparison}
              className={`transition-colors ${
                isInComparison 
                  ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-950 dark:border-green-800 dark:text-green-300' 
                  : ''
              }`}
              data-testid={`button-compare-${job.id}`}
            >
              <Scale className="mr-2 h-4 w-4" />
              {isInComparison ? 'Added' : 'Compare'}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleSave} data-testid={`button-share-${job.id}`}>
            Share
          </Button>
        </div>
        <Button 
          onClick={handleApply} 
          disabled={applyMutation.isPending}
          size="sm"
          className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
          data-testid={`button-apply-${job.id}`}
        >
          {applyMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Applying...
            </>
          ) : (
            'Apply Now'
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}