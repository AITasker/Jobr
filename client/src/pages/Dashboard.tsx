import { useState } from 'react'
import { Header } from '@/components/Header'
import { useAuth } from '@/hooks/useAuth'
import { CVUpload } from '@/components/CVUpload'
import { JobCard } from '@/components/JobCard'
import { ApplicationTracker } from '@/components/ApplicationTracker'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Search, Filter, Briefcase, Target, FileText } from 'lucide-react'

export default function Dashboard() {
  const { user } = useAuth()

  const [cvUploaded, setCvUploaded] = useState(true) // Mock CV uploaded state

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
      jobTitle: 'Senior Frontend Developer',
      company: 'TechCorp Solutions',
      appliedDate: '3 days ago',
      status: 'interviewing' as const,
      matchScore: 92,
      emailOpened: true,
      interviewDate: 'Tomorrow, 3:00 PM',
      notes: 'Great company culture, exciting project opportunities'
    },
    {
      id: '2',
      jobTitle: 'Product Designer',
      company: 'Design Studio',
      appliedDate: '1 week ago',
      status: 'viewed' as const,
      matchScore: 78,
      emailOpened: true,
      notes: 'Waiting for design challenge response'
    },
    {
      id: '3',
      jobTitle: 'Full Stack Engineer',
      company: 'StartupXYZ',
      appliedDate: '2 weeks ago',
      status: 'applied' as const,
      matchScore: 85,
      emailOpened: false
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
            Welcome back, {user.name}! Here's your job search overview.
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
                  {mockJobs.map((job) => (
                    <JobCard key={job.id} job={job} />
                  ))}
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