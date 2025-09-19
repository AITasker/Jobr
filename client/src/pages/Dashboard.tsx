import { useState, useEffect, useCallback } from 'react'
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
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { useQuery, useMutation } from '@tanstack/react-query'
import { apiRequest, queryClient } from '@/lib/queryClient'
import { useToast } from '@/hooks/use-toast'
import { Search, Filter, Briefcase, Target, FileText, Loader2, AlertCircle, Plus, RefreshCw, TrendingUp, MapPin, DollarSign, Clock, ChevronDown, Bookmark, History, Brain, X } from 'lucide-react'
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
  suggestions?: SearchSuggestion[]
  processingMethod: 'ai-enhanced' | 'ai' | 'basic'
  timestamp?: string
}

interface SearchSuggestion {
  type: 'query' | 'skill' | 'company' | 'location' | 'role'
  text: string
  count: number
  relevance: number
}

interface JobInsights {
  marketTrends: {
    skillDemand: { skill: string; demand: 'high' | 'medium' | 'low'; growth: number }[]
    salaryTrends: { role: string; averageSalary: number; trend: 'up' | 'down' | 'stable' }[]
    locationHotspots: { location: string; jobCount: number; avgSalary: number }[]
  }
  careerProgression: {
    nextRoles: string[]
    skillGaps: string[]
    timeToTransition: string
    salaryGrowthPotential: number
  }
  personalization: {
    recommendedSearches: string[]
    suggestedFilters: any
    trendingOpportunities: JobMatchResponse[]
  }
}

// Extended application type that includes job details for the UI
interface ApplicationWithJob extends DatabaseApplication {
  job: DatabaseJob
}

export default function Dashboard() {
  // ALL HOOKS MUST BE CALLED FIRST - NO CONDITIONAL LOGIC BEFORE HOOKS
  const { user, isAuthenticated, isLoading } = useAuth()
  const { toast } = useToast()
  const [, setLocation] = useLocation()
  
  // Enhanced search and filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [salaryRange, setSalaryRange] = useState([0, 200000])
  const [experienceLevel, setExperienceLevel] = useState('')
  const [remoteOnly, setRemoteOnly] = useState(false)
  const [datePosted, setDatePosted] = useState('')
  const [skillsFilter, setSkillsFilter] = useState<string[]>([])
  const [sortBy, setSortBy] = useState('relevance')
  const [activeTab, setActiveTab] = useState('jobs')
  const [isAddApplicationModalOpen, setIsAddApplicationModalOpen] = useState(false)
  const [selectedApplication, setSelectedApplication] = useState<ApplicationWithJob | null>(null)
  const [isEditApplicationModalOpen, setIsEditApplicationModalOpen] = useState(false)
  
  // Search suggestions and insights state
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [searchSuggestions, setSearchSuggestions] = useState<SearchSuggestion[]>([])
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  
  // Job comparison state
  const [compareJobs, setCompareJobs] = useState<JobMatchResponse[]>([])
  const [showComparison, setShowComparison] = useState(false)

  // All queries must be called before any conditional logic
  const { data: cvData, isLoading: cvLoading, error: cvError } = useQuery<CVResponse | null>({
    queryKey: ['/api/cv'],
    enabled: Boolean(isAuthenticated),
    retry: false
  })

  // Helper function to validate CV data - defined immediately after cvData query
  const cvOk = (cv: CVResponse | null): boolean => !!(cv && typeof cv.id === 'string' && cv.id.length && cv.userId && cv.fileName)

  // Enhanced CV validation with proper type checking
  const hasCvData = cvOk(cvData || null)

  // Get matched jobs with proper CV validation
  const { data: matchedJobsData, isLoading: matchedJobsLoading, error: matchedJobsError } = useQuery<MatchedJobsResponse>({
    queryKey: ['/api/jobs/matched', cvData?.id],
    enabled: Boolean(isAuthenticated && hasCvData && cvData?.id),
    retry: false
  })

  // Get all applications
  const { data: applications, isLoading: applicationsLoading } = useQuery<ApplicationWithJob[]>({
    queryKey: ['/api/applications'],
    enabled: Boolean(isAuthenticated),
    retry: false
  })

  // Enhanced job search with new API endpoint - only when on search tab
  const searchParams = {
    q: searchQuery,
    location: locationFilter,
    type: typeFilter,
    minSalary: salaryRange[0] > 0 ? salaryRange[0] : undefined,
    maxSalary: salaryRange[1] < 200000 ? salaryRange[1] : undefined,
    experience: experienceLevel || undefined,
    remote: remoteOnly || undefined,
    datePosted: datePosted || undefined,
    skills: skillsFilter.length > 0 ? skillsFilter.join(',') : undefined
  }

  const { data: searchResults, isLoading: searchLoading, error: searchError, refetch: refetchSearch } = useQuery<SearchResultsResponse>({
    queryKey: ['/api/jobs/search/enhanced', searchParams],
    enabled: Boolean(isAuthenticated && hasCvData && activeTab === 'search' && (searchQuery || locationFilter || typeFilter || experienceLevel || remoteOnly || skillsFilter.length > 0)),
    retry: false
  })

  // Job insights query for market analysis
  const { data: jobInsights, isLoading: insightsLoading } = useQuery<{insights: JobInsights}>({
    queryKey: ['/api/jobs/insights'],
    enabled: Boolean(isAuthenticated && hasCvData && activeTab === 'jobs'),
    retry: false,
    staleTime: 30 * 60 * 1000 // Cache for 30 minutes
  })

  // Debounced search suggestions
  const fetchSearchSuggestions = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchSuggestions([])
      return
    }

    setIsLoadingSuggestions(true)
    try {
      const response = await apiRequest('GET', `/api/search/suggestions?q=${encodeURIComponent(query)}`)
      const data = await response.json()
      if (data.success) {
        setSearchSuggestions(data.suggestions || [])
      }
    } catch (error) {
      console.error('Error fetching search suggestions:', error)
    } finally {
      setIsLoadingSuggestions(false)
    }
  }, [])

  // Debounce search suggestions
  useEffect(() => {
    const timer = setTimeout(() => {
      if (showSuggestions) {
        fetchSearchSuggestions(searchQuery)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, showSuggestions, fetchSearchSuggestions])

  // NOW SAFE TO ADD CONDITIONAL LOGIC AFTER ALL HOOKS ARE CALLED
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

  const handleCVUpload = () => {
    // Invalidate the CV query to refetch the updated CV data
    queryClient.invalidateQueries({ queryKey: ['/api/cv'] })
    // Also invalidate job matches since we have new CV data
    queryClient.invalidateQueries({ queryKey: ['/api/jobs/matched'] })
    // Invalidate insights for fresh analysis
    queryClient.invalidateQueries({ queryKey: ['/api/jobs/insights'] })
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

  const handleSearchSuggestionSelect = (suggestion: SearchSuggestion) => {
    setSearchQuery(suggestion.text)
    setShowSuggestions(false)
    // Trigger search
    setTimeout(() => refetchSearch(), 100)
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    setLocationFilter('')
    setTypeFilter('')
    setSalaryRange([0, 200000])
    setExperienceLevel('')
    setRemoteOnly(false)
    setDatePosted('')
    setSkillsFilter([])
    setShowSuggestions(false)
  }

  const addSkillFilter = (skill: string) => {
    if (!skillsFilter.includes(skill)) {
      setSkillsFilter([...skillsFilter, skill])
    }
  }

  const removeSkillFilter = (skill: string) => {
    setSkillsFilter(skillsFilter.filter(s => s !== skill))
  }

  const addToComparison = (jobMatch: JobMatchResponse) => {
    if (compareJobs.length >= 3) {
      toast({
        title: "Comparison Limit Reached",
        description: "You can compare up to 3 jobs at a time.",
        variant: "destructive"
      })
      return
    }
    
    if (!compareJobs.some(job => job.job.id === jobMatch.job.id)) {
      setCompareJobs([...compareJobs, jobMatch])
      toast({
        title: "Added to Comparison",
        description: `${jobMatch.job.title} added to comparison list.`,
      })
    }
  }

  const removeFromComparison = (jobId: string) => {
    setCompareJobs(compareJobs.filter(job => job.job.id !== jobId))
  }

  const sortJobResults = (jobs: JobMatchResponse[], sortMethod: string): JobMatchResponse[] => {
    const sorted = [...jobs]
    
    switch (sortMethod) {
      case 'match-score':
        return sorted.sort((a, b) => b.matchScore - a.matchScore)
      case 'date':
        return sorted.sort((a, b) => new Date(b.job.postedDate || 0).getTime() - new Date(a.job.postedDate || 0).getTime())
      case 'salary-high':
        return sorted.sort((a, b) => {
          const aMax = a.job.salary ? parseInt(a.job.salary.replace(/\D/g, '')) : 0
          const bMax = b.job.salary ? parseInt(b.job.salary.replace(/\D/g, '')) : 0
          return bMax - aMax
        })
      case 'salary-low':
        return sorted.sort((a, b) => {
          const aMin = a.job.salary ? parseInt(a.job.salary.replace(/\D/g, '')) : 0
          const bMin = b.job.salary ? parseInt(b.job.salary.replace(/\D/g, '')) : 0
          return aMin - bMin
        })
      case 'company':
        return sorted.sort((a, b) => a.job.company.localeCompare(b.job.company))
      case 'relevance':
      default:
        return sorted // Keep original AI-enhanced relevance order
    }
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

        {/* Enhanced Quick Stats with Insights */}
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
            {/* Job Insights Section */}
            {jobInsights?.insights && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    Career Insights
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-foreground">Next Career Steps</h4>
                      <div className="flex flex-wrap gap-1">
                        {jobInsights.insights.careerProgression.nextRoles.slice(0, 3).map((role, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-foreground">Skills to Develop</h4>
                      <div className="flex flex-wrap gap-1">
                        {jobInsights.insights.careerProgression.skillGaps.slice(0, 3).map((skill, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-foreground">Growth Potential</h4>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium">
                          +{jobInsights.insights.careerProgression.salaryGrowthPotential}% salary growth
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

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
                      <JobCard 
                        key={jobMatch.job.id} 
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
            {/* Enhanced Job Search */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5" />
                    Enhanced Job Search
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                      data-testid="button-advanced-filters"
                    >
                      <Filter className="h-4 w-4 mr-2" />
                      Advanced Filters
                      <ChevronDown className={`h-4 w-4 ml-2 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Basic Search Filters */}
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2 relative">
                    <Label htmlFor="job-search">Job Title or Keywords</Label>
                    <Input
                      id="job-search"
                      placeholder="e.g. Frontend Developer, React"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                      data-testid="input-job-search"
                    />
                    
                    {/* Search Suggestions Dropdown */}
                    {showSuggestions && (searchSuggestions.length > 0 || isLoadingSuggestions) && (
                      <Card className="absolute top-full left-0 right-0 z-50 mt-1 shadow-lg">
                        <CardContent className="p-2">
                          {isLoadingSuggestions ? (
                            <div className="flex items-center justify-center py-2">
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              <span className="text-sm text-muted-foreground">Loading suggestions...</span>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {searchSuggestions.map((suggestion, index) => (
                                <Button
                                  key={index}
                                  variant="ghost"
                                  size="sm"
                                  className="w-full justify-start text-left h-auto py-2"
                                  onClick={() => handleSearchSuggestionSelect(suggestion)}
                                  data-testid={`suggestion-${index}`}
                                >
                                  <div className="flex items-center gap-2">
                                    {suggestion.type === 'skill' && <Target className="h-3 w-3" />}
                                    {suggestion.type === 'company' && <Briefcase className="h-3 w-3" />}
                                    {suggestion.type === 'location' && <MapPin className="h-3 w-3" />}
                                    {suggestion.type === 'query' && <Search className="h-3 w-3" />}
                                    <span className="text-sm">{suggestion.text}</span>
                                    <Badge variant="secondary" className="text-xs ml-auto">
                                      {suggestion.count}
                                    </Badge>
                                  </div>
                                </Button>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location-filter">Location</Label>
                    <Input
                      id="location-filter"
                      placeholder="e.g. Bangalore, Remote"
                      value={locationFilter}
                      onChange={(e) => setLocationFilter(e.target.value)}
                      data-testid="input-location-filter"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type-filter">Job Type</Label>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger data-testid="select-job-type">
                        <SelectValue placeholder="Any type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any type</SelectItem>
                        <SelectItem value="Full-time">Full-time</SelectItem>
                        <SelectItem value="Part-time">Part-time</SelectItem>
                        <SelectItem value="Contract">Contract</SelectItem>
                        <SelectItem value="Freelance">Freelance</SelectItem>
                        <SelectItem value="Internship">Internship</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Advanced Filters */}
                {showAdvancedFilters && (
                  <div className="space-y-6 pt-4 border-t">
                    <div className="grid gap-6 md:grid-cols-2">
                      {/* Salary Range */}
                      <div className="space-y-4">
                        <Label>Salary Range (Annual)</Label>
                        <div className="space-y-2">
                          <Slider
                            value={salaryRange}
                            onValueChange={setSalaryRange}
                            max={200000}
                            min={0}
                            step={5000}
                            className="w-full"
                            data-testid="slider-salary-range"
                          />
                          <div className="flex justify-between text-sm text-muted-foreground">
                            <span>${salaryRange[0].toLocaleString()}</span>
                            <span>{salaryRange[1] >= 200000 ? '$200k+' : `$${salaryRange[1].toLocaleString()}`}</span>
                          </div>
                        </div>
                      </div>

                      {/* Experience Level */}
                      <div className="space-y-2">
                        <Label htmlFor="experience-level">Experience Level</Label>
                        <Select value={experienceLevel} onValueChange={setExperienceLevel}>
                          <SelectTrigger data-testid="select-experience-level">
                            <SelectValue placeholder="Any level" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="any">Any level</SelectItem>
                            <SelectItem value="entry-level">Entry Level (0-2 years)</SelectItem>
                            <SelectItem value="mid-level">Mid Level (2-5 years)</SelectItem>
                            <SelectItem value="senior-level">Senior Level (5-8 years)</SelectItem>
                            <SelectItem value="executive-level">Executive Level (8+ years)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Date Posted */}
                      <div className="space-y-2">
                        <Label htmlFor="date-posted">Date Posted</Label>
                        <Select value={datePosted} onValueChange={setDatePosted}>
                          <SelectTrigger data-testid="select-date-posted">
                            <SelectValue placeholder="Any time" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="any">Any time</SelectItem>
                            <SelectItem value="1">Last 24 hours</SelectItem>
                            <SelectItem value="7">Last 7 days</SelectItem>
                            <SelectItem value="30">Last 30 days</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Remote Work */}
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="remote-only"
                          checked={remoteOnly}
                          onCheckedChange={setRemoteOnly}
                          data-testid="switch-remote-only"
                        />
                        <Label htmlFor="remote-only">Remote work only</Label>
                      </div>
                    </div>

                    {/* Skills Filter */}
                    <div className="space-y-2">
                      <Label>Skills Filter</Label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {skillsFilter.map((skill, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {skill}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-auto p-0 ml-1"
                              onClick={() => removeSkillFilter(skill)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </Badge>
                        ))}
                      </div>
                      {cvData?.skills && (
                        <div className="flex flex-wrap gap-1">
                          <span className="text-sm text-muted-foreground mr-2">Your skills:</span>
                          {cvData.skills.slice(0, 10).map((skill, index) => (
                            <Button
                              key={index}
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => addSkillFilter(skill)}
                              disabled={skillsFilter.includes(skill)}
                            >
                              + {skill}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={() => refetchSearch()}
                    className="flex items-center gap-2"
                    disabled={!searchQuery && !locationFilter && !typeFilter && !experienceLevel && !remoteOnly && skillsFilter.length === 0}
                    data-testid="button-search-jobs"
                  >
                    <Search className="h-4 w-4" />
                    Search Jobs
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleClearSearch}
                    data-testid="button-clear-search"
                  >
                    Clear All
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            {/* Enhanced Search Results */}
            {(searchQuery || locationFilter || typeFilter || experienceLevel || remoteOnly || skillsFilter.length > 0) && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Search Results</CardTitle>
                    <div className="flex items-center gap-3">
                      {/* Sorting Options */}
                      {searchResults?.results && searchResults.results.length > 1 && (
                        <div className="flex items-center gap-2">
                          <Label htmlFor="sort-by" className="text-sm text-muted-foreground">Sort by:</Label>
                          <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className="w-[140px] h-8" data-testid="select-sort-by">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="relevance">Relevance</SelectItem>
                              <SelectItem value="match-score">Match Score</SelectItem>
                              <SelectItem value="date">Date Posted</SelectItem>
                              <SelectItem value="salary-high">Salary (High)</SelectItem>
                              <SelectItem value="salary-low">Salary (Low)</SelectItem>
                              <SelectItem value="company">Company</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      
                      {/* Job Comparison Toggle */}
                      {compareJobs.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowComparison(!showComparison)}
                          data-testid="button-toggle-comparison"
                        >
                          Compare ({compareJobs.length})
                        </Button>
                      )}
                      
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" data-testid="badge-search-results">
                          {searchLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : searchResults?.results ? (
                            `${searchResults.results.length} results`
                          ) : (
                            "0 results"
                          )}
                        </Badge>
                        {searchResults?.processingMethod && (
                          <Badge variant="outline" className="text-xs">
                            {searchResults.processingMethod === 'ai-enhanced' ? 'AI Enhanced' : 
                             searchResults.processingMethod === 'ai' ? 'AI Powered' : 'Basic'}
                          </Badge>
                        )}
                      </div>
                    </div>
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
                      <span className="ml-2 text-muted-foreground">Searching jobs with AI enhancement...</span>
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
                    <div className="space-y-6">
                      {/* Search suggestions from results */}
                      {searchResults.suggestions && searchResults.suggestions.length > 0 && (
                        <div className="p-4 bg-muted/30 rounded-lg">
                          <h4 className="text-sm font-medium text-foreground mb-2">Related searches</h4>
                          <div className="flex flex-wrap gap-2">
                            {searchResults.suggestions.slice(0, 5).map((suggestion, index) => (
                              <Button
                                key={index}
                                variant="outline"
                                size="sm"
                                className="h-7 px-3 text-xs"
                                onClick={() => handleSearchSuggestionSelect(suggestion)}
                              >
                                {suggestion.text}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Job Results Grid */}
                      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {sortJobResults(searchResults.results, sortBy).map((jobMatch: JobMatchResponse) => (
                          <JobCard 
                            key={jobMatch.job.id} 
                            jobMatch={{
                              ...jobMatch,
                              job: {
                                ...jobMatch.job,
                                salary: jobMatch.job.salary || undefined
                              }
                            } as any}
                            onAddToComparison={() => addToComparison(jobMatch)}
                            isInComparison={compareJobs.some(job => job.job.id === jobMatch.job.id)}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (searchQuery || locationFilter || typeFilter || experienceLevel || remoteOnly || skillsFilter.length > 0) ? (
                    <div className="text-center py-12">
                      <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="text-lg font-medium text-foreground mb-2">No Jobs Found</h3>
                      <p className="text-muted-foreground mb-4">
                        No jobs match your search criteria. Try adjusting your filters or search terms.
                      </p>
                      <div className="flex gap-2 justify-center">
                        <Button
                          variant="outline"
                          onClick={handleClearSearch}
                          data-testid="button-clear-search-results"
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
                        Enter job title, keywords, location, or use advanced filters to find opportunities.
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
                    applications={applications as any}
                    onEditApplication={(app) => {
                      setSelectedApplication(app as any)
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
          application={selectedApplication as any}
          isOpen={isEditApplicationModalOpen}
          onOpenChange={setIsEditApplicationModalOpen}
        />
      </main>
    </div>
  )
}