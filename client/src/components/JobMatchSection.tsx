import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { JobCard } from '@/components/JobCard'
import { Loader2, Target, RefreshCw, Search, Sparkles, Plus } from 'lucide-react'

interface JobMatchSectionProps {
  title: string
  icon?: React.ReactNode
  matches: any[]
  isLoading: boolean
  error: any
  onRefresh: () => void
  onSearchJobs?: () => void
  isEnhanced?: boolean
  enhancementData?: any
}

export function JobMatchSection({ 
  title, 
  icon, 
  matches, 
  isLoading, 
  error, 
  onRefresh, 
  onSearchJobs,
  isEnhanced = false,
  enhancementData
}: JobMatchSectionProps) {
  
  if (isLoading) {
    return (
      <Card className={isEnhanced ? "border-primary bg-primary/5" : ""}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {icon || <Target className="h-5 w-5" />}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">
                {isEnhanced ? "Finding enhanced job matches..." : "Finding job matches..."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={isEnhanced ? "border-primary bg-primary/5" : ""}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {icon || <Target className="h-5 w-5" />}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="space-y-4">
              <div className="text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  {isEnhanced ? "Enhanced Matching Error" : "Job Matching Error"}
                </h3>
                <p className="mb-4">
                  {error?.message || 'There was an error finding job matches. Please try again.'}
                </p>
              </div>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={onRefresh} data-testid="button-retry-matches">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                {onSearchJobs && (
                  <Button variant="ghost" onClick={onSearchJobs} data-testid="button-search-jobs">
                    <Search className="h-4 w-4 mr-2" />
                    Search Jobs
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!matches || matches.length === 0) {
    return (
      <Card className={isEnhanced ? "border-primary bg-primary/5" : ""}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {icon || <Target className="h-5 w-5" />}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {isEnhanced ? "No Enhanced Matches Found" : "No Job Matches Found"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {isEnhanced 
                ? "We couldn't find enhanced job matches. Try adding a more detailed job description."
                : "We couldn't find any job matches based on your current CV. Check back later for new opportunities."
              }
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={onRefresh} data-testid="button-refresh-matches">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              {onSearchJobs && (
                <Button variant="ghost" onClick={onSearchJobs} data-testid="button-search-jobs">
                  <Search className="h-4 w-4 mr-2" />
                  Search Jobs
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={isEnhanced ? "border-primary bg-primary/5" : ""}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon || <Target className="h-5 w-5" />}
          {title}
          <Badge variant={isEnhanced ? "default" : "secondary"} className="ml-auto">
            {matches.length} match{matches.length !== 1 ? 'es' : ''}
          </Badge>
        </CardTitle>
        {isEnhanced && enhancementData && (
          <div className="text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Enhanced with job description • Match improvement: +{enhancementData.improvement || 0}%
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {matches.map((jobMatch: any) => (
            <JobCard 
              key={`${isEnhanced ? 'enhanced-' : ''}${jobMatch.job.id}`}
              jobMatch={{
                ...jobMatch,
                job: {
                  ...jobMatch.job,
                  salary: jobMatch.job.salary || undefined
                }
              } as any} 
            />
          ))}
        </div>
        
        {/* Action buttons */}
        <div className="flex gap-2 justify-center mt-6 pt-4 border-t">
          <Button variant="outline" onClick={onRefresh} data-testid="button-refresh-matches">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Matches
          </Button>
          {onSearchJobs && (
            <Button variant="ghost" onClick={onSearchJobs} data-testid="button-search-jobs">
              <Search className="h-4 w-4 mr-2" />
              Advanced Search
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}