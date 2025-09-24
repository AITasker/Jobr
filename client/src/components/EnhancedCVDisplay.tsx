import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { User, Mail, MapPin, FileText, Sparkles, Target, TrendingUp } from 'lucide-react'

interface CVData {
  id: string
  fileName: string
  parsedData: any
  skills: string[]
  experience: string
  education: string
  // Enhanced fields from JD integration
  jobDescription?: string
  enhancedSkills?: string[]
  enhancedSummary?: string
  matchScore?: number
  jdAnalysis?: any
}

interface EnhancedCVDisplayProps {
  cvData: CVData
  enhancedData?: any
  showEnhanced?: boolean
}

export function EnhancedCVDisplay({ cvData, enhancedData, showEnhanced = false }: EnhancedCVDisplayProps) {
  const displayData = showEnhanced && enhancedData ? enhancedData : cvData.parsedData
  const skills = showEnhanced && enhancedData?.enhancedSkills ? enhancedData.enhancedSkills : cvData.skills || []
  
  return (
    <Card className={showEnhanced ? "border-primary bg-primary/5" : ""}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {showEnhanced ? (
            <><Sparkles className="h-5 w-5 text-primary" />Enhanced CV with Job Description</>
          ) : (
            <><User className="h-5 w-5" />Your CV Profile</>
          )}
          {showEnhanced && enhancedData?.matchScore && (
            <Badge variant="default" className="ml-auto">
              {enhancedData.matchScore}% Match
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Personal Information */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Personal Information
          </h3>
          <div className="grid gap-2">
            {displayData?.name && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{displayData.name}</span>
              </div>
            )}
            {displayData?.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{displayData.email}</span>
              </div>
            )}
            {displayData?.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{displayData.location}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{cvData.fileName}</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Enhanced Summary (only for enhanced CV) */}
        {showEnhanced && enhancedData?.enhancedSummary && (
          <>
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Target className="h-4 w-4" />
                Enhanced Professional Summary
              </h3>
              <p className="text-sm leading-relaxed bg-muted/50 p-3 rounded-lg">
                {enhancedData.enhancedSummary}
              </p>
            </div>
            <Separator />
          </>
        )}

        {/* Skills */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Skills {showEnhanced && "(Enhanced)"}
          </h3>
          <div className="flex flex-wrap gap-2">
            {skills.map((skill: string, index: number) => (
              <Badge 
                key={index} 
                variant={showEnhanced && index >= (cvData.skills?.length || 0) ? "default" : "secondary"}
                className={showEnhanced && index >= (cvData.skills?.length || 0) ? "bg-primary/10 text-primary border-primary/20" : ""}
                data-testid={`skill-badge-${index}`}
              >
                {skill}
              </Badge>
            ))}
          </div>
          {showEnhanced && (
            <div className="text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Highlighted skills are enhanced based on job requirements
              </span>
            </div>
          )}
        </div>

        <Separator />

        {/* Experience */}
        {(displayData?.experience || cvData.experience) && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Experience
            </h3>
            <div className="text-sm leading-relaxed">
              {displayData?.experience || cvData.experience}
            </div>
          </div>
        )}

        {/* Education */}
        {(displayData?.education || cvData.education) && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Education
              </h3>
              <div className="text-sm leading-relaxed">
                {displayData?.education || cvData.education}
              </div>
            </div>
          </>
        )}

        {/* Enhancement Metrics (only for enhanced CV) */}
        {showEnhanced && enhancedData && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Enhancement Metrics
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {enhancedData.matchScore && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Job Match Score</span>
                      <span className="font-medium">{enhancedData.matchScore}%</span>
                    </div>
                    <Progress value={enhancedData.matchScore} className="h-2" />
                  </div>
                )}
                {enhancedData.keywordMatches && (
                  <div className="space-y-1">
                    <span className="text-sm font-medium">Keywords Matched</span>
                    <div className="text-2xl font-bold text-primary">
                      {enhancedData.keywordMatches.length}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}