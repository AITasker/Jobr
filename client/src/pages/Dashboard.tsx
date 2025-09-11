import { useState } from 'react'
import { useLocation } from 'wouter'
import { Header } from '@/components/Header'
import { useAuth } from '@/hooks/useAuth'
import { CVUpload } from '@/components/CVUpload'
import { JobCard } from '@/components/JobCard'
import { ApplicationTracker } from '@/components/ApplicationTracker'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useQuery, useMutation } from '@tanstack/react-query'
import { apiRequest, queryClient } from '@/lib/queryClient'
import { useToast } from '@/hooks/use-toast'
import { Search, Filter, Briefcase, Target, FileText, Loader2, AlertCircle } from 'lucide-react'

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
  const [activeTab, setActiveTab] = useState('matched')
  const [cvUploaded, setCvUploaded] = useState(false)

  // Check if user has a CV uploaded
  const { data: cvData, isLoading: cvLoading } = useQuery({
    queryKey: ['/api/cv'],
    enabled: isAuthenticated,
    retry: false
  })

  // Get matched jobs
  const { data: matchedJobsData, isLoading: matchedJobsLoading, error: matchedJobsError } = useQuery({
    queryKey: ['/api/jobs/matched', { limit: 20 }],
    enabled: isAuthenticated && !!cvData,
    retry: false
  })

  // Get all applications
  const { data: applications, isLoading: applicationsLoading } = useQuery({
    queryKey: ['/api/applications'],
    enabled: isAuthenticated,
    retry: false
  })

  // Search jobs with filters
  const { data: searchResults, isLoading: searchLoading, refetch: refetchSearch } = useQuery({
    queryKey: ['/api/jobs/search', { q: searchQuery, location: locationFilter, type: typeFilter }],
    enabled: Boolean(isAuthenticated && !!cvData && activeTab === 'search' && (searchQuery || locationFilter || typeFilter)),
    retry: false
  })

  const mockJobs = [
    {
      id: '1',
      title: 'Senior Frontend Developer',
      company: 'TechCorp Solutions',
      location: 'Bangalore, India',
      type: 'Full-time',
      salary: '₹15-25 LPA',
      postedDate: '2 days ago',
      matchScore: 92,
      description: 'We are looking for an experienced Frontend Developer to join our dynamic team. You will be responsible for developing user-facing web applications using modern JavaScript frameworks.',
      requirements: ['React', 'TypeScript', 'Tailwind CSS', 'Node.js', '5+ years experience']
    },
    {
      id: '2',
      title: 'Product Designer',
      company: 'Design Studio',
      location: 'Mumbai, India',
      type: 'Contract',
      postedDate: '1 week ago',
      matchScore: 78,
      description: 'Join our creative team to design intuitive user experiences for mobile and web applications.',
      requirements: ['Figma', 'UI/UX Design', 'Prototyping', 'User Research']
    },
    {
      id: '3',
      title: 'Full Stack Engineer',
      company: 'InnovateTech',
      location: 'Remote',
      type: 'Full-time',
      salary: '₹12-20 LPA',
      postedDate: '3 days ago',
      matchScore: 85,
      description: 'Build scalable web applications using modern technologies in a fast-paced startup environment.',
      requirements: ['React', 'Node.js', 'MongoDB', 'AWS', '3+ years experience']
    }
  ]

  const mockApplications = [
    {
      id: '1',
      jobId: 'job-1',
      userId: (user as any)?.id || 'user-1',
      jobTitle: 'Senior Frontend Developer',
      company: 'TechCorp Solutions',
      appliedDate: '3 days ago',
      status: 'interviewing' as const,
      matchScore: 92,
      emailOpened: true,
      interviewDate: 'Tomorrow, 3:00 PM',
      notes: 'Great company culture, exciting project opportunities',
      job: {
        id: 'job-1',
        title: 'Senior Frontend Developer',
        company: 'TechCorp Solutions',
        description: 'We are looking for an experienced Frontend Developer to join our dynamic team.',
        requirements: ['React', 'TypeScript', 'Tailwind CSS', 'Node.js', '5+ years experience']
      }
    },
    {
      id: '2',
      jobId: 'job-2',
      userId: (user as any)?.id || 'user-1',
      jobTitle: 'Product Designer',
      company: 'Design Studio',
      appliedDate: '1 week ago',
      status: 'viewed' as const,
      matchScore: 78,
      emailOpened: true,
      notes: 'Waiting for design challenge response',
      job: {
        id: 'job-2',
        title: 'Product Designer',
        company: 'Design Studio',
        description: 'Join our creative team to design intuitive user experiences for mobile and web applications.',
        requirements: ['Figma', 'UI/UX Design', 'Prototyping', 'User Research']
      }
    },
    {
      id: '3',
      jobId: 'job-3',
      userId: (user as any)?.id || 'user-1',
      jobTitle: 'Full Stack Engineer',
      company: 'StartupXYZ',
      appliedDate: '2 weeks ago',
      status: 'applied' as const,
      matchScore: 85,
      emailOpened: false,
      job: {
        id: 'job-3',
        title: 'Full Stack Engineer',
        company: 'StartupXYZ',
        description: 'Build scalable web applications using modern technologies in a fast-paced startup environment.',
        requirements: ['React', 'Node.js', 'MongoDB', 'AWS', '3+ years experience']
      }
    }
  ]

  const handleCVUpload = (cvData: any) => {
    console.log('CV uploaded:', cvData)
    setCvUploaded(true)
  }

  if (!cvUploaded) {
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
            <CVUpload onUploadComplete={handleCVUpload} />
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
              <div className="text-2xl font-bold text-foreground" data-testid="stat-new-matches">12</div>
              <div className="text-sm text-muted-foreground">New Matches</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Target className="h-6 w-6 mx-auto mb-2 text-accent-foreground" />
              <div className="text-2xl font-bold text-foreground" data-testid="stat-applications-sent">8</div>
              <div className="text-sm text-muted-foreground">Applications Sent</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <FileText className="h-6 w-6 mx-auto mb-2 text-green-600" />
              <div className="text-2xl font-bold text-foreground" data-testid="stat-interviews">2</div>
              <div className="text-sm text-muted-foreground">Interviews</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary" data-testid="stat-match-rate">89%</div>
              <div className="text-sm text-muted-foreground">Avg Match Rate</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="jobs" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="jobs" data-testid="tab-job-matches">
              Job Matches
            </TabsTrigger>
            <TabsTrigger value="applications" data-testid="tab-applications">
              Applications
            </TabsTrigger>
          </TabsList>

          <TabsContent value="jobs" className="space-y-6">
            {/* Search and Filters */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5" />
                    Job Matches
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" data-testid="badge-total-matches">
                      {mockJobs.length} matches
                    </Badge>
                    <Button variant="outline" size="sm" data-testid="button-filter-jobs">
                      <Filter className="h-4 w-4 mr-2" />
                      Filter
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {mockJobs.map((job) => {
                    // Convert job to jobMatch format for JobCard component
                    const jobMatch = {
                      job,
                      matchScore: job.matchScore,
                      explanation: `${job.matchScore}% match based on your profile`,
                      skillsMatch: {
                        matched: job.requirements?.slice(0, 3) || [],
                        missing: [],
                        score: job.matchScore
                      },
                      experienceMatch: {
                        suitable: job.matchScore >= 75,
                        explanation: 'Experience level appears suitable',
                        score: job.matchScore
                      },
                      locationMatch: {
                        suitable: true,
                        explanation: 'Location matches your preferences',
                        score: 85
                      },
                      salaryMatch: {
                        suitable: true,
                        explanation: 'Salary range within expectations',
                        score: 80
                      }
                    }
                    return (
                      <JobCard key={job.id} jobMatch={jobMatch} />
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="applications" className="space-y-6">
            <ApplicationTracker applications={mockApplications} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}