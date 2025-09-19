import { useState } from 'react'
import { useLocation } from 'wouter'
import { Header } from '@/components/Header'
import { useAuth } from '@/hooks/useAuth'
import { CVUpload } from '@/components/CVUpload'
import { JobCard } from '@/components/JobCard'
import { ApplicationTracker } from '@/components/ApplicationTracker'
import { AddApplicationModal } from '@/components/AddApplicationModal'
import { EditApplicationModal } from '@/components/EditApplicationModal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useQuery, useMutation } from '@tanstack/react-query'
import { apiRequest, queryClient } from '@/lib/queryClient'
import { useToast } from '@/hooks/use-toast'
import { Search, Filter, Briefcase, Target, FileText, Loader2, AlertCircle, Plus, RefreshCw } from 'lucide-react'
import type { Application as DatabaseApplication, Job as DatabaseJob, Cv as DatabaseCv } from '@shared/schema'

// Response interfaces aligned with backend API responses
interface CVResponse {
  id: string
  userId: string
  fileName: string
  parsedData: any
  skills: string[]
  experience: string
  education: string
  createdAt: string
  updatedAt: string
}

interface JobMatchResponse {
  job: DatabaseJob & {
    postedDate: string
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

interface MatchedJobsResponse {
  matches: JobMatchResponse[]
  total: number
  processingMethod: 'ai' | 'basic'
}

interface SearchResultsResponse {
  results: JobMatchResponse[]
  total: number
  filters: any
  processingMethod: 'ai' | 'basic'
}

// Extended application type that includes job details for the UI
interface ApplicationWithJob extends DatabaseApplication {
  job: DatabaseJob
}

export default function Dashboard() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const { toast } = useToast()
  const [, setLocation] = useLocation()

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Redirect to landing page if not authenticated
  if (!isAuthenticated) {
    setLocation('/');
    return null;
  }
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [activeTab, setActiveTab] = useState('jobs')
  const [isAddApplicationModalOpen, setIsAddApplicationModalOpen] = useState(false)
  const [selectedApplication, setSelectedApplication] = useState<ApplicationWithJob | null>(null)
  const [isEditApplicationModalOpen, setIsEditApplicationModalOpen] = useState(false)

  // Check if user has a CV uploaded with proper type checking
  const { data: cvData, isLoading: cvLoading, error: cvError } = useQuery<CVResponse | null>({
    queryKey: ['/api/cv'],
    enabled: isAuthenticated,
    retry: false
  })

  // Helper function to validate CV data - defined immediately after cvData query
  const cvOk = (cv: CVResponse | null): boolean => !!(cv && typeof cv.id === 'string' && cv.id.length && cv.userId && cv.fileName)

  // Enhanced CV validation with proper type checking - moved above useQuery usage to fix TDZ
  const hasCvData = cvOk(cvData)

  // Get matched jobs with proper CV validation
  const { data: matchedJobsData, isLoading: matchedJobsLoading, error: matchedJobsError } = useQuery<MatchedJobsResponse>({
    queryKey: ['/api/jobs/matched', { limit: 20 }],
    enabled: isAuthenticated && hasCvData,
    retry: false
  })

  // Get all applications
  const { data: applications, isLoading: applicationsLoading } = useQuery<ApplicationWithJob[]>({
    queryKey: ['/api/applications'],
    enabled: isAuthenticated,
    retry: false
  })

  // Search jobs with filters - only when on search tab to prevent unnecessary background fetching
  const { data: searchResults, isLoading: searchLoading, error: searchError, refetch: refetchSearch } = useQuery<SearchResultsResponse>({
    queryKey: ['/api/jobs/search', { q: searchQuery, location: locationFilter, type: typeFilter }],
    enabled: Boolean(isAuthenticated && hasCvData && activeTab === 'search' && (searchQuery || locationFilter || typeFilter)),
    retry: false
  })


  const handleCVUpload = () => {
    // Invalidate the CV query to refetch the updated CV data
    queryClient.invalidateQueries({ queryKey: ['/api/cv'] })
    // Also invalidate job matches since we have new CV data
    queryClient.invalidateQueries({ queryKey: ['/api/jobs/matched'] })
    toast({
      title: "CV Processed Successfully!",
      description: "Your CV has been analyzed and you can now view matched jobs.",
    })
  }

  const handleJobMatchingTrigger = () => {
    // Switch to jobs tab and trigger job matching
    setActiveTab('jobs')
    // Invalidate matched jobs to fetch fresh results
    queryClient.invalidateQueries({ queryKey: ['/api/jobs/matched'] })
    toast({
      title: "Finding Your Perfect Matches!",
      description: "Our AI is analyzing your CV against thousands of job opportunities.",
    })
  }

  // Calculate dashboard statistics from real data
  const stats = {
    newMatches: matchedJobsData?.matches?.length || 0,
    applicationsSent: applications?.length || 0,
    interviews: applications?.filter(app => app.status === 'interviewing').length || 0,
    averageMatchRate: applications && applications.length > 0 
      ? Math.round(applications.reduce((sum, app) => sum + (app.matchScore || 0), 0) / applications.length)
      : 0
  }

  const showCvUpload = !cvLoading && !hasCvData;
  const hasValidCvForMatching = hasCvData && cvData?.parsedData && cvData?.skills && cvData.skills.length > 0;

  if (showCvUpload) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-2">Welcome to Career Co-Pilot!</h1>
              <p className="text-muted-foreground">
                Let's get started by uploading your CV. Our AI will analyze it to find perfect job matches.
              </p>
            </div>
            <CVUpload 
              onUploadComplete={handleCVUpload} 
              onJobMatchingTrigger={handleJobMatchingTrigger}
            />
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-6">
        {/* Dashboard Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {(user as any)?.name || 'User'}! Here's your job search overview.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <Briefcase className="h-6 w-6 mx-auto mb-2 text-primary" />
              <div className="text-2xl font-bold text-foreground" data-testid="stat-new-matches">
                {matchedJobsLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  stats.newMatches
                )}
              </div>
              <div className="text-sm text-muted-foreground">New Matches</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Target className="h-6 w-6 mx-auto mb-2 text-accent-foreground" />
              <div className="text-2xl font-bold text-foreground" data-testid="stat-applications-sent">
                {applicationsLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  stats.applicationsSent
                )}
              </div>
              <div className="text-sm text-muted-foreground">Applications Sent</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <FileText className="h-6 w-6 mx-auto mb-2 text-green-600" />
              <div className="text-2xl font-bold text-foreground" data-testid="stat-interviews">
                {applicationsLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  stats.interviews
                )}
              </div>
              <div className="text-sm text-muted-foreground">Interviews</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary" data-testid="stat-match-rate">
                {applicationsLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  `${stats.averageMatchRate}%`
                )}
              </div>
              <div className="text-sm text-muted-foreground">Avg Match Rate</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="jobs" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-lg">
            <TabsTrigger value="jobs" data-testid="tab-job-matches">
              Job Matches
            </TabsTrigger>
            <TabsTrigger value="search" data-testid="tab-job-search">
              Search Jobs
            </TabsTrigger>
            <TabsTrigger value="applications" data-testid="tab-applications">
              Applications
            </TabsTrigger>
          </TabsList>

          <TabsContent value="jobs" className="space-y-6">
            {/* AI Job Matches */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    AI Job Matches
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" data-testid="badge-total-matches">
                      {matchedJobsLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : matchedJobsData?.matches ? (
                        `${matchedJobsData.matches.length} matches`
                      ) : (
                        "0 matches"
                      )}
                    </Badge>
                    {matchedJobsData?.processingMethod && (
                      <Badge variant="outline" className="text-xs">
                        {matchedJobsData.processingMethod === 'ai' ? 'AI Powered' : 'Basic'}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {matchedJobsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span className="ml-2 text-muted-foreground">Finding your perfect job matches...</span>
                  </div>
                ) : matchedJobsError ? (
                  <div className="text-center py-12">
                    <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
                    <h3 className="text-lg font-medium text-foreground mb-2">Unable to Load Job Matches</h3>
                    <p className="text-muted-foreground mb-4">
                      {!hasCvData
                        ? 'Please upload your CV first to see personalized job matches.'
                        : !hasValidCvForMatching
                        ? 'Your CV needs to be processed before we can find matches. Please re-upload your CV.'
                        : (matchedJobsError as any)?.message || 'There was an error loading your job matches. Please try again.'}
                    </p>
                    <div className="flex gap-2 justify-center">
                      {!hasCvData || !hasValidCvForMatching ? (
                        <Button 
                          variant="default" 
                          onClick={() => {
                            setActiveTab('jobs');
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          data-testid="button-upload-cv"
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Upload CV
                        </Button>
                      ) : (
                        <Button 
                          variant="outline" 
                          onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/jobs/matched'] })}
                          data-testid="button-retry-matches"
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Try Again
                        </Button>
                      )}
                    </div>
                  </div>
                ) : matchedJobsData?.matches && matchedJobsData.matches.length > 0 ? (
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {matchedJobsData.matches.map((jobMatch: JobMatchResponse) => (
                      <JobCard key={jobMatch.job.id} jobMatch={jobMatch} />
                    ))}
                  </div>
                ) : hasCvData ? (
                  <div className="text-center py-12">
                    <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No Job Matches Found</h3>
                    <p className="text-muted-foreground mb-4">
                      {hasValidCvForMatching 
                        ? "We couldn't find any job matches based on your current CV. Check back later for new opportunities."
                        : "Your CV is still being processed. Please wait a moment and try again."}
                    </p>
                    <div className="flex gap-2 justify-center">
                      <Button 
                        variant="outline" 
                        onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/jobs/matched'] })}
                        data-testid="button-refresh-matches"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                      </Button>
                      <Button 
                        variant="ghost" 
                        onClick={() => setActiveTab('search')}
                        data-testid="button-search-jobs"
                      >
                        <Search className="h-4 w-4 mr-2" />
                        Search Jobs
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium text-foreground mb-2">CV Required for Job Matching</h3>
                    <p className="text-muted-foreground mb-4">
                      Upload your CV to get personalized job matches based on your skills and experience.
                    </p>
                    <Button 
                      variant="default" 
                      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                      data-testid="button-upload-cv-cta"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Upload Your CV
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="search" className="space-y-6">
            {/* Job Search */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Search Jobs
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search Filters */}
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <label htmlFor="job-search" className="text-sm font-medium text-foreground">
                      Job Title or Keywords
                    </label>
                    <Input
                      id="job-search"
                      placeholder="e.g. Frontend Developer, React"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      data-testid="input-job-search"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="location-filter" className="text-sm font-medium text-foreground">
                      Location
                    </label>
                    <Input
                      id="location-filter"
                      placeholder="e.g. Bangalore, Remote"
                      value={locationFilter}
                      onChange={(e) => setLocationFilter(e.target.value)}
                      data-testid="input-location-filter"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="type-filter" className="text-sm font-medium text-foreground">
                      Job Type
                    </label>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger data-testid="select-job-type">
                        <SelectValue placeholder="Any type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Any type</SelectItem>
                        <SelectItem value="Full-time">Full-time</SelectItem>
                        <SelectItem value="Part-time">Part-time</SelectItem>
                        <SelectItem value="Contract">Contract</SelectItem>
                        <SelectItem value="Freelance">Freelance</SelectItem>
                        <SelectItem value="Internship">Internship</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  onClick={() => refetchSearch()}
                  className="flex items-center gap-2"
                  disabled={!searchQuery && !locationFilter && !typeFilter}
                  data-testid="button-search-jobs"
                >
                  <Search className="h-4 w-4" />
                  Search Jobs
                </Button>
              </CardContent>
            </Card>
            
            {/* Search Results */}
            {(searchQuery || locationFilter || typeFilter) && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Search Results</CardTitle>
                    <Badge variant="secondary" data-testid="badge-search-results">
                      {searchLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : searchResults?.results ? (
                        `${searchResults.results.length} results`
                      ) : (
                        "0 results"
                      )}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {!hasCvData ? (
                    <div className="text-center py-12">
                      <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="text-lg font-medium text-foreground mb-2">CV Required for Job Search</h3>
                      <p className="text-muted-foreground mb-4">
                        Upload your CV first to search and get personalized job recommendations.
                      </p>
                      <Button 
                        variant="default" 
                        onClick={() => {
                          setActiveTab('jobs');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        data-testid="button-upload-cv-search"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Upload CV
                      </Button>
                    </div>
                  ) : searchLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin" />
                      <span className="ml-2 text-muted-foreground">Searching jobs...</span>
                    </div>
                  ) : searchError ? (
                    <div className="text-center py-12">
                      <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
                      <h3 className="text-lg font-medium text-foreground mb-2">Search Failed</h3>
                      <p className="text-muted-foreground mb-4">
                        {(searchError as any)?.message || 'There was an error searching for jobs. Please try again.'}
                      </p>
                      <Button 
                        variant="outline" 
                        onClick={() => refetchSearch()}
                        data-testid="button-retry-search"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Try Again
                      </Button>
                    </div>
                  ) : searchResults?.results && searchResults.results.length > 0 ? (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {searchResults.results.map((jobMatch: JobMatchResponse) => (
                        <JobCard key={jobMatch.job.id} jobMatch={jobMatch} />
                      ))}
                    </div>
                  ) : (searchQuery || locationFilter || typeFilter) ? (
                    <div className="text-center py-12">
                      <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="text-lg font-medium text-foreground mb-2">No Jobs Found</h3>
                      <p className="text-muted-foreground mb-4">
                        No jobs match your search criteria. Try adjusting your filters or search terms.
                      </p>
                      <div className="flex gap-2 justify-center">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSearchQuery('')
                            setLocationFilter('')
                            setTypeFilter('')
                          }}
                          data-testid="button-clear-search"
                        >
                          Clear Search
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setActiveTab('jobs')}
                          data-testid="button-view-matches"
                        >
                          <Target className="h-4 w-4 mr-2" />
                          View Matches
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Search className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                      <h4 className="text-md font-medium text-foreground mb-2">Ready to Search</h4>
                      <p className="text-sm text-muted-foreground">
                        Enter job title, keywords, location, or job type above to find opportunities.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="applications" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    Your Applications
                  </CardTitle>
                  <Button
                    onClick={() => setIsAddApplicationModalOpen(true)}
                    className="flex items-center gap-2"
                    data-testid="button-add-application"
                  >
                    <Plus className="h-4 w-4" />
                    Add Application
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {applicationsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span className="ml-2 text-muted-foreground">Loading your applications...</span>
                  </div>
                ) : applications && applications.length > 0 ? (
                  <ApplicationTracker 
                    applications={applications}
                    onEditApplication={(app) => {
                      setSelectedApplication(app as ApplicationWithJob)
                      setIsEditApplicationModalOpen(true)
                    }}
                  />
                ) : (
                  <div className="text-center py-8">
                    <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No Applications Yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Start tracking your job applications to monitor your progress and stay organized.
                    </p>
                    <div className="flex gap-2 justify-center">
                      <Button
                        onClick={() => setIsAddApplicationModalOpen(true)}
                        className="flex items-center gap-2"
                        data-testid="button-add-first-application"
                      >
                        <Plus className="h-4 w-4" />
                        Add Your First Application
                      </Button>
                      {hasCvData && (
                        <Button
                          variant="outline"
                          onClick={() => setActiveTab('jobs')}
                          className="flex items-center gap-2"
                          data-testid="button-find-jobs"
                        >
                          <Target className="h-4 w-4" />
                          Find Jobs
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modals */}
        <AddApplicationModal
          isOpen={isAddApplicationModalOpen}
          onOpenChange={setIsAddApplicationModalOpen}
        />
        
        <EditApplicationModal
          application={selectedApplication}
          isOpen={isEditApplicationModalOpen}
          onOpenChange={setIsEditApplicationModalOpen}
        />
      </main>
    </div>
  )
}