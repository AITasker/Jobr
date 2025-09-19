import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { useQuery, useMutation } from '@tanstack/react-query'
import { apiRequest, queryClient } from '@/lib/queryClient'
import { useToast } from '@/hooks/use-toast'
import { 
  User, 
  Mail, 
  MapPin, 
  BrainCircuit, 
  Award, 
  GraduationCap, 
  Briefcase,
  Target,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Sparkles,
  RefreshCw
} from 'lucide-react'

interface CVData {
  skills: string[]
  experience: string
  education: string
  name?: string | null
  email?: string | null
  location?: string | null
}

interface CVAnalysis {
  skillsAnalysis: {
    totalSkills: number
    categories: string[]
    recommendations: string[]
  }
  experienceAnalysis: {
    hasRelevantExperience: boolean
    level: string
    recommendations: string[]
  }
  completenessScore: number
  strengthsAndWeaknesses?: {
    strengths: string[]
    weaknesses: string[]
  }
}

interface CVAnalysisDisplayProps {
  cvData: CVData
  onTriggerJobMatching?: () => void
  onReUpload?: () => void
}

export function CVAnalysisDisplay({ cvData, onTriggerJobMatching, onReUpload }: CVAnalysisDisplayProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const { toast } = useToast()

  // Fetch CV analysis
  const { data: analysisData, isLoading: analysisLoading, error: analysisError, refetch: refetchAnalysis } = useQuery({
    queryKey: ['/api/cv/analyze'],
    retry: 2
  })

  // Get personalized recommendations
  const { data: personalizationData, refetch: refetchPersonalization } = useQuery({
    queryKey: ['/api/ai/personalize'],
    enabled: false // Only fetch when explicitly triggered
  })

  // Mutation to get personalized recommendations
  const personalizationMutation = useMutation({
    mutationFn: (data: { targetRole?: string, targetIndustry?: string, preferences?: any }) => 
      apiRequest('/api/ai/personalize', { 
        method: 'POST', 
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai/personalize'] })
      toast({
        title: "Personalized Recommendations Generated!",
        description: "AI has created custom recommendations based on your goals.",
      })
    },
    onError: (error) => {
      console.error('Personalization error:', error)
      toast({
        title: "Personalization Failed",
        description: "Unable to generate personalized recommendations. Please try again.",
        variant: "destructive"
      })
    }
  })

  const handleGetPersonalizedRecommendations = () => {
    personalizationMutation.mutate({
      targetRole: 'Software Developer', // Could be made dynamic
      preferences: {
        preferredLocation: cvData.location,
        careerGoals: 'advancement'
      }
    })
  }

  const handleJobMatching = () => {
    if (onTriggerJobMatching) {
      onTriggerJobMatching()
    }
    toast({
      title: "Finding Job Matches...",
      description: "Our AI is analyzing your CV to find the best job opportunities.",
    })
  }

  if (analysisLoading) {
    return (
      <Card className="slide-in-up">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-muted-foreground mb-2">Analyzing your CV with AI...</p>
          <div className="flex items-center gap-1 mt-2">
            <div className="w-2 h-2 bg-primary rounded-full processing-indicator"></div>
            <div className="w-2 h-2 bg-primary rounded-full processing-indicator animation-delay-200"></div>
            <div className="w-2 h-2 bg-primary rounded-full processing-indicator animation-delay-400"></div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">This may take a few seconds...</p>
        </CardContent>
      </Card>
    )
  }

  if (analysisError) {
    return (
      <Card className="slide-in-up">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h3 className="text-lg font-semibold mb-2">Analysis Failed</h3>
          <p className="text-muted-foreground mb-4">
            We couldn't analyze your CV right now. You can still view your uploaded CV and find job matches.
          </p>
          <div className="flex gap-2">
            <Button
              onClick={() => refetchAnalysis()}
              variant="outline"
              data-testid="button-retry-analysis"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry Analysis
            </Button>
            <Button
              onClick={onReUpload}
              data-testid="button-reupload-after-error"
            >
              Upload Different CV
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const analysis = analysisData?.analysis || {}
  const recommendations = analysisData?.recommendations || []
  const completenessScore = analysis.completenessScore || 0

  return (
    <div className="space-y-6 slide-in-up">
      {/* CV Overview Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                CV Analysis Results
              </CardTitle>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                {cvData.name && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {cvData.name}
                  </span>
                )}
                {cvData.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {cvData.email}
                  </span>
                )}
                {cvData.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {cvData.location}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchAnalysis()}
                disabled={analysisLoading}
                data-testid="button-refresh-analysis"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh Analysis
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onReUpload}
                data-testid="button-reupload-cv"
              >
                Upload New CV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Completeness Score */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">CV Completeness</span>
              <span className="text-sm text-muted-foreground">{completenessScore}%</span>
            </div>
            <Progress value={completenessScore} className="h-2" data-testid="progress-completeness" />
            <p className="text-xs text-muted-foreground">
              {completenessScore >= 80 ? 'Excellent! Your CV is comprehensive.' :
               completenessScore >= 60 ? 'Good! Consider adding more details for better matching.' :
               'Your CV could benefit from more detailed information.'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Analysis Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="skills" data-testid="tab-skills">Skills</TabsTrigger>
          <TabsTrigger value="recommendations" data-testid="tab-recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="personalization" data-testid="tab-personalization">Personalize</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Skills Overview */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BrainCircuit className="h-4 w-4" />
                  Skills Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Skills</span>
                    <Badge variant="secondary" data-testid="badge-skills-count">
                      {cvData.skills?.length || 0}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {cvData.skills?.slice(0, 8).map((skill, index) => (
                      <Badge key={index} variant="outline" className="text-xs" data-testid={`skill-${index}`}>
                        {skill}
                      </Badge>
                    ))}
                    {(cvData.skills?.length || 0) > 8 && (
                      <Badge variant="outline" className="text-xs">
                        +{(cvData.skills?.length || 0) - 8} more
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Experience Overview */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Experience Level
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Level</span>
                    <Badge 
                      variant={analysis.experienceAnalysis?.hasRelevantExperience ? "default" : "secondary"}
                      data-testid="badge-experience-level"
                    >
                      {analysis.experienceAnalysis?.level || 'Entry-level'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3">
                    {cvData.experience?.substring(0, 150) || 'No experience details available'}...
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Education */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                Education Background
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground" data-testid="text-education">
                {cvData.education || 'No education information available'}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="skills" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Skills Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {analysis.skillsAnalysis?.categories && analysis.skillsAnalysis.categories.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Skill Categories</h4>
                  <div className="flex flex-wrap gap-2">
                    {analysis.skillsAnalysis.categories.map((category: string, index: number) => (
                      <Badge key={index} variant="secondary" data-testid={`category-${index}`}>
                        {category}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              <Separator />
              
              <div>
                <h4 className="font-medium mb-3">All Skills</h4>
                <div className="grid gap-2">
                  {cvData.skills && cvData.skills.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {cvData.skills.map((skill, index) => (
                        <Badge key={index} variant="outline" data-testid={`detailed-skill-${index}`}>
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No skills were extracted from your CV. Consider adding a skills section.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                AI Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recommendations && recommendations.length > 0 ? (
                <div className="space-y-3">
                  {recommendations.map((recommendation: string, index: number) => (
                    <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm" data-testid={`recommendation-${index}`}>
                        {recommendation}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No specific recommendations available.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="personalization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Personalized Career Guidance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <Button
                  onClick={handleGetPersonalizedRecommendations}
                  disabled={personalizationMutation.isPending}
                  className="flex items-center gap-2"
                  data-testid="button-get-personalized-recommendations"
                >
                  {personalizationMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Generating Recommendations...
                    </>
                  ) : (
                    <>
                      <Target className="h-4 w-4" />
                      Get Personalized Recommendations
                    </>
                  )}
                </Button>
              </div>
              
              {personalizationData && (
                <div className="space-y-4 mt-6">
                  {Object.entries(personalizationData.personalizedRecommendations || {}).map(([key, values]) => (
                    <div key={key} className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </h4>
                      <ul className="space-y-1">
                        {(values as string[]).map((value, index) => (
                          <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                            <CheckCircle className="h-3 w-3 text-green-500 mt-1 flex-shrink-0" />
                            {value}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={handleJobMatching}
              className="flex items-center gap-2"
              size="lg"
              data-testid="button-find-job-matches"
            >
              <Target className="h-4 w-4" />
              Find Job Matches
            </Button>
            <Button
              variant="outline"
              onClick={onReUpload}
              size="lg"
              data-testid="button-upload-different-cv"
            >
              Upload Different CV
            </Button>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-3">
            Ready to find your perfect job match? Our AI will analyze your CV against thousands of opportunities.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}