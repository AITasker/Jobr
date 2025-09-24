import { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'wouter'
import { Header } from '@/components/Header'
import { useAuth } from '@/hooks/useAuth'
import { CVUpload } from '@/components/CVUpload'
import { JDUpload } from '@/components/JDUpload'
import { JobCard } from '@/components/JobCard'
import { EnhancedCVDisplay } from '@/components/EnhancedCVDisplay'
import { JobMatchSection } from '@/components/JobMatchSection'
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useQuery, useMutation } from '@tanstack/react-query'
import { apiRequest, queryClient } from '@/lib/queryClient'
import { useToast } from '@/hooks/use-toast'
import { Search, Filter, Briefcase, Target, FileText, Loader2, AlertCircle, Plus, RefreshCw, TrendingUp, MapPin, DollarSign, Clock, ChevronDown, Bookmark, History, Brain, X, Sparkles, Mail } from 'lucide-react'
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
  
  // JD Integration state
  const [jdIntegrated, setJdIntegrated] = useState(false)
  const [enhancedCvData, setEnhancedCvData] = useState<any>(null)
  const [enhancedJobMatches, setEnhancedJobMatches] = useState<JobMatchResponse[]>([])
  const [isLoadingEnhancedMatches, setIsLoadingEnhancedMatches] = useState(false)
  const [showNewCVUpload, setShowNewCVUpload] = useState(false)
  const [showCompleteCVModal, setShowCompleteCVModal] = useState(false)

  // All queries must be called before any conditional logic
  const { data: cvData, isLoading: cvLoading, error: cvError } = useQuery<CVResponse | null>({
    queryKey: ['/api/cv'],
    enabled: isAuthenticated,
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
    enabled: isAuthenticated,
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
    enabled: isAuthenticated && hasCvData && activeTab === 'jobs',
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

  // JD Integration handlers
  const handleJDIntegrated = async (enhancedData: any) => {
    setJdIntegrated(true)
    setEnhancedCvData(enhancedData)
    setIsLoadingEnhancedMatches(true)
    
    try {
      // Refresh CV data to get the updated enhanced fields from backend
      await queryClient.invalidateQueries({ queryKey: ['/api/cv/latest'] })
      
      // Get enhanced job matches from backend using the enhanced CV
      const response = await fetch(`/api/jobs/match/${cvData?.id}?enhanced=true`)
      if (response.ok) {
        const data = await response.json()
        setEnhancedJobMatches(data.matches || [])
        
        toast({
          title: "CV Enhanced Successfully!",
          description: `Found ${data.matches?.length || 0} enhanced job matches based on the job description.`,
        })
      } else {
        // Fallback to original matches if enhanced matching fails
        console.warn('Enhanced job matching failed, using original matches')
        setEnhancedJobMatches(matchedJobsData?.matches || [])
        
        toast({
          title: "CV Enhanced!",
          description: "Enhanced CV created. Using original job matches as enhanced matching is temporarily unavailable.",
          variant: "default"
        })
      }
    } catch (error) {
      console.error('Error getting enhanced job matches:', error)
      // Fallback to original matches on error
      setEnhancedJobMatches(matchedJobsData?.matches || [])
      
      toast({
        title: "CV Enhanced!",
        description: "Enhanced CV created. Using original job matches due to a temporary issue.",
        variant: "default"
      })
    } finally {
      setIsLoadingEnhancedMatches(false)
    }
  }

  const handleRefreshOriginalMatches = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/jobs/matched'] })
  }

  const handleRefreshEnhancedMatches = () => {
    if (jdIntegrated && enhancedCvData) {
      handleJDIntegrated(enhancedCvData)
    }
  }

  const handleDownloadEnhancedCV = () => {
    if (!enhancedCvData || !enhancedCvData.enhancedCv) {
      toast({
        title: "Download Failed",
        description: "Enhanced CV content not available for download.",
        variant: "destructive"
      })
      return
    }

    try {
      // Create downloadable content
      const content = enhancedCvData.enhancedCv
      const blob = new Blob([content], { type: 'text/plain' })
      const url = window.URL.createObjectURL(blob)
      
      // Create download link
      const link = document.createElement('a')
      link.href = url
      link.download = `Enhanced-CV-${new Date().toISOString().split('T')[0]}.txt`
      document.body.appendChild(link)
      link.click()
      
      // Cleanup
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      toast({
        title: "Download Started",
        description: "Your enhanced CV has been downloaded successfully.",
      })
    } catch (error) {
      console.error('Download error:', error)
      toast({
        title: "Download Failed",
        description: "There was an error downloading your enhanced CV. Please try again.",
        variant: "destructive"
      })
    }
  }

  const handleNewCVUpload = () => {
    // Reset all CV-related state
    setJdIntegrated(false)
    setEnhancedCvData(null)
    setEnhancedJobMatches([])
    setShowNewCVUpload(false)
    
    // Invalidate queries to refresh data
    queryClient.invalidateQueries({ queryKey: ['/api/cv'] })
    queryClient.invalidateQueries({ queryKey: ['/api/jobs/matched'] })
    
    toast({
      title: "CV Upload Ready",
      description: "You can now upload a new CV. Your previous data has been cleared.",
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

          <TabsContent value="jobs" className="space-y-8">
            {/* 4-Box Sequential Flow as requested */}
            
            {/* BOX 1: Uploaded CV */}
            {hasCvData && (
              <div data-testid="box-uploaded-cv" className="relative">
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full animate-pulse"></div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <span className="bg-gradient-to-br from-primary to-indigo-600 text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold shadow-lg">1</span>
Your CV Profile
                  </h2>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowCompleteCVModal(true)}
                      data-testid="button-view-complete-cv"
                      className="hover-elevate"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      View Complete CV
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowNewCVUpload(true)}
                      data-testid="button-upload-new-cv"
                      className="hover-elevate"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Upload New CV
                    </Button>
                  </div>
                </div>
                <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white/70 dark:bg-gray-800/70 p-3 rounded-lg backdrop-blur-sm border border-white/40">
                        <div className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1 flex items-center gap-1"><Mail className="h-3 w-3" />Email</div>
                        <div className="text-sm text-muted-foreground truncate">{cvData?.parsedData?.email || 'Not specified'}</div>
                      </div>
                      <div className="bg-white/70 dark:bg-gray-800/70 p-3 rounded-lg backdrop-blur-sm border border-white/40">
                        <div className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1 flex items-center gap-1"><Target className="h-3 w-3" />Skills</div>
                        <div className="text-sm text-muted-foreground">{cvData?.skills?.length || 0} identified</div>
                      </div>
                      <div className="bg-white/70 dark:bg-gray-800/70 p-3 rounded-lg backdrop-blur-sm border border-white/40">
                        <div className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1 flex items-center gap-1"><FileText className="h-3 w-3" />File</div>
                        <div className="text-sm text-muted-foreground truncate">{cvData?.fileName}</div>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
Processed
                      </Badge>
                      <Badge variant="outline" className="bg-indigo-100 text-indigo-800 border-indigo-200">
                        Ready for Matching
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* BOX 2: AI Job Analysis */}
            {hasCvData && (
              <div data-testid="box-job-analysis">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <span className="bg-gradient-to-br from-primary to-purple-600 text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold shadow-lg">2</span>
AI Job Analysis
                </h2>
                <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-lg">
                        <Brain className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-blue-900 dark:text-blue-100">AI-Powered Analysis</h3>
                        <p className="text-sm text-blue-700 dark:text-blue-300">Analyzing your CV for the best opportunities</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white/70 dark:bg-gray-800/70 p-4 rounded-lg backdrop-blur-sm border border-white/40">
                        <div className="text-2xl font-bold text-blue-600 mb-1">
                          {matchedJobsLoading ? (
                            <Loader2 className="h-6 w-6 animate-spin" />
                          ) : (
                            matchedJobsData?.matches?.length || 0
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">Jobs Found</div>
                      </div>
                      <div className="bg-white/70 dark:bg-gray-800/70 p-4 rounded-lg backdrop-blur-sm border border-white/40">
                        <div className="text-2xl font-bold text-green-600 mb-1">
                          {matchedJobsData?.processingMethod === 'ai' ? 'AI' : 'Basic'}
                        </div>
                        <div className="text-sm text-muted-foreground">AI Enhanced</div>
                      </div>
                      <div className="bg-white/70 dark:bg-gray-800/70 p-4 rounded-lg backdrop-blur-sm border border-white/40">
                        <div className="text-2xl font-bold text-blue-600 mb-1">92%</div>
                        <div className="text-sm text-muted-foreground">Avg Match</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Interactive Jobs Table */}
                {matchedJobsData?.matches && matchedJobsData.matches.length > 0 && (
                  <Card className="mt-6 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 border-indigo-200 dark:border-indigo-800">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="bg-indigo-100 dark:bg-indigo-900 p-2 rounded-lg">
                          <Briefcase className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-indigo-900 dark:text-indigo-100">Matched Jobs</h3>
                          <p className="text-sm text-indigo-700 dark:text-indigo-300">Jobs that match your CV profile</p>
                        </div>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-indigo-200 dark:border-indigo-800">
                              <th className="text-left py-3 px-2 text-sm font-medium text-indigo-900 dark:text-indigo-100">Job Title</th>
                              <th className="text-left py-3 px-2 text-sm font-medium text-indigo-900 dark:text-indigo-100">Company</th>
                              <th className="text-left py-3 px-2 text-sm font-medium text-indigo-900 dark:text-indigo-100">Location</th>
                              <th className="text-left py-3 px-2 text-sm font-medium text-indigo-900 dark:text-indigo-100">Match</th>
                              <th className="text-left py-3 px-2 text-sm font-medium text-indigo-900 dark:text-indigo-100">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {matchedJobsData.matches.map((match, index) => (
                              <tr key={index} className="border-b border-indigo-100 dark:border-indigo-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/50">
                                <td className="py-3 px-2">
                                  <div className="font-medium text-foreground">{match.job.title}</div>
                                  <div className="text-sm text-muted-foreground truncate max-w-xs">{match.job.description?.substring(0, 100)}...</div>
                                </td>
                                <td className="py-3 px-2 text-sm text-foreground">{match.job.company}</td>
                                <td className="py-3 px-2 text-sm text-foreground">{match.job.location}</td>
                                <td className="py-3 px-2">
                                  <Badge 
                                    variant="outline" 
                                    className={`${
                                      match.matchScore >= 80 ? 'bg-green-100 text-green-800 border-green-200' :
                                      match.matchScore >= 60 ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                      'bg-red-100 text-red-800 border-red-200'
                                    }`}
                                  >
                                    {Math.round(match.matchScore)}%
                                  </Badge>
                                </td>
                                <td className="py-3 px-2">
                                  <div className="flex gap-2">
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      data-testid={`button-view-jd-${index}`}
                                    >
                                      View JD
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="default"
                                      data-testid={`button-apply-${index}`}
                                    >
                                      Apply
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* BOX 3: Job Description Integration */}
            {hasCvData && !jdIntegrated && (
              <div data-testid="box-jd-integration">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <span className="bg-muted text-muted-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">3</span>
                  Enhance Your Matches (Optional)
                </h2>
                <JDUpload 
                  cvId={cvData?.id || ''}
                  onJDIntegrated={() => handleJDIntegrated({})}
                  onJobMatchingTrigger={handleJobMatchingTrigger}
                />
              </div>
            )}

            {/* BOX 3: Enhanced CV (after JD integration) */}
            {jdIntegrated && enhancedCvData && (
              <div data-testid="box-enhanced-cv">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <span className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">3</span>
                    Enhanced CV with Job Description
                  </h2>
                  <Button 
                    variant="default" 
                    size="sm"
                    onClick={() => handleDownloadEnhancedCV()}
                    data-testid="button-download-enhanced-cv"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Download Enhanced CV
                  </Button>
                </div>
                <EnhancedCVDisplay 
                  cvData={cvData as any} 
                  enhancedData={enhancedCvData}
                  showEnhanced={true} 
                />
              </div>
            )}

            {/* BOX 4: Enhanced Job Matches (after JD integration) */}
            {jdIntegrated && (
              <div data-testid="box-enhanced-matches">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">4</span>
                  Enhanced Job Matches
                </h2>
                <JobMatchSection
                  title="Enhanced Job Matches"
                  icon={<Sparkles className="h-5 w-5 text-primary" />}
                  matches={enhancedJobMatches}
                  isLoading={isLoadingEnhancedMatches}
                  error={null}
                  onRefresh={handleRefreshEnhancedMatches}
                  onSearchJobs={() => setActiveTab('search')}
                  isEnhanced={true}
                  enhancementData={enhancedCvData}
                />
              </div>
            )}

            {/* Show CV upload if no CV */}
            {!hasCvData && (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium text-foreground mb-2">Upload Your CV to Get Started</h3>
                <p className="text-muted-foreground mb-4">
                  Upload your CV to see personalized job matches and enhance them with specific job descriptions.
                </p>
                <Button 
                  variant="default" 
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  data-testid="button-upload-cv-start"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Upload Your CV
                </Button>
              </div>
            )}

            {/* BOX 4: Final Job Matches - Always show either enhanced or regular matches */}
            {hasCvData && (
              <div data-testid="box-final-matches" className="relative">
                <div className="absolute -top-2 -left-2 w-4 h-4 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full animate-pulse"></div>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <span className="bg-gradient-to-br from-primary to-blue-600 text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold shadow-lg">4</span>
                  {jdIntegrated ? '✨ Enhanced Job Matches' : '🎯 Your Job Matches'}
                </h2>
                <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                          {jdIntegrated ? <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" /> : <Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
                        </div>
                        <div>
                          <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                            {jdIntegrated ? 'AI-Enhanced Matches' : 'Personalized Matches'}
                          </h3>
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            {jdIntegrated ? 'Optimized for your target job' : 'Based on your CV profile'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={jdIntegrated ? "default" : "secondary"} className={jdIntegrated ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" : ""}>
                          {(jdIntegrated ? isLoadingEnhancedMatches : matchedJobsLoading) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            `${(jdIntegrated ? enhancedJobMatches : matchedJobsData?.matches)?.length || 0} matches`
                          )}
                        </Badge>
                        {jdIntegrated && (
                          <Badge variant="outline" className="bg-gradient-to-r from-indigo-100 to-blue-100 text-indigo-800 border-indigo-200">
                            Enhanced
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <JobMatchSection
                      title={jdIntegrated ? "Enhanced Job Matches" : "Your Job Matches"}
                      icon={jdIntegrated ? <Sparkles className="h-5 w-5 text-primary" /> : <Target className="h-5 w-5" />}
                      matches={jdIntegrated ? enhancedJobMatches : (matchedJobsData?.matches || [])}
                      isLoading={jdIntegrated ? isLoadingEnhancedMatches : matchedJobsLoading}
                      error={jdIntegrated ? null : matchedJobsError}
                      onRefresh={jdIntegrated ? handleRefreshEnhancedMatches : handleRefreshOriginalMatches}
                      onSearchJobs={() => setActiveTab('search')}
                      isEnhanced={jdIntegrated}
                      enhancementData={jdIntegrated ? enhancedCvData : undefined}
                    />
                  </CardContent>
                </Card>
              </div>
            )}
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

        {/* Complete CV Modal */}
        <Dialog open={showCompleteCVModal} onOpenChange={setShowCompleteCVModal}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Complete CV Details
              </DialogTitle>
              <DialogDescription>
                Full details of your uploaded CV profile
              </DialogDescription>
            </DialogHeader>
            {cvData && (
              <div className="space-y-6">
                {/* Basic Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Basic Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Email</label>
                        <p className="text-foreground">{cvData.parsedData?.email || 'Not specified'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Phone</label>
                        <p className="text-foreground">{cvData.parsedData?.phone || 'Not specified'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Location</label>
                        <p className="text-foreground">{cvData.parsedData?.location || 'Not specified'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">File Name</label>
                        <p className="text-foreground">{cvData.fileName}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Skills */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Skills</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {cvData.skills && cvData.skills.length > 0 ? (
                        cvData.skills.map((skill, index) => (
                          <Badge key={index} variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
                            {skill}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-muted-foreground">No skills identified</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Experience */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Experience</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none">
                      <p className="text-foreground whitespace-pre-wrap">
                        {cvData.experience || cvData.parsedData?.experience || 'No experience information available'}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Education */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Education</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none">
                      <p className="text-foreground whitespace-pre-wrap">
                        {cvData.education || cvData.parsedData?.education || 'No education information available'}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Summary */}
                {cvData.parsedData?.summary && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-foreground">{cvData.parsedData.summary}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* New CV Upload Modal */}
        <Dialog open={showNewCVUpload} onOpenChange={setShowNewCVUpload}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Upload New CV</DialogTitle>
              <DialogDescription>
                Upload a new CV to replace your current one. This will reset your job matches and any enhanced CV data.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <CVUpload 
                onUploadComplete={handleNewCVUpload} 
                onJobMatchingTrigger={handleJobMatchingTrigger}
              />
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}