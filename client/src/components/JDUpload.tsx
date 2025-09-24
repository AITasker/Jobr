import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { Loader2, FileText, Sparkles, Target, Upload } from 'lucide-react'
import { apiRequest } from '@/lib/queryClient'

interface JDUploadProps {
  cvId: string
  onJDIntegrated: () => void
  onJobMatchingTrigger: () => void
}

export function JDUpload({ cvId, onJDIntegrated, onJobMatchingTrigger }: JDUploadProps) {
  const [jobDescription, setJobDescription] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const integrateJDMutation = useMutation({
    mutationFn: async () => {
      if (!jobDescription.trim()) {
        throw new Error('Please enter a job description')
      }

      const response = await apiRequest('POST', `/api/cv/${cvId}/integrate-jd`, {
        jobDescription: jobDescription.trim()
      })
      const data = await response.json()
      if (!data.success) throw new Error(data.message)
      return data
    },
    onSuccess: (data) => {
      toast({
        title: "Job Description Integrated!",
        description: "Your CV has been enhanced with job-specific keywords and skills.",
      })
      
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/cv'] })
      queryClient.invalidateQueries({ queryKey: ['/api/jobs/matched'] })
      
      onJDIntegrated()
      onJobMatchingTrigger()
      
      // Reset form
      setJobDescription('')
      setIsExpanded(false)
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Integration Failed",
        description: error.message || "Failed to integrate job description. Please try again.",
      })
    }
  })

  const handleIntegrateJD = () => {
    integrateJDMutation.mutate()
  }

  if (!isExpanded) {
    return (
      <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
        <CardContent className="p-6 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">Enhance Your Job Matches</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Add a specific job description to get more targeted matches and an AI-enhanced CV
              </p>
            </div>
            <Button 
              onClick={() => setIsExpanded(true)}
              className="gap-2"
              data-testid="button-add-jd"
            >
              <Upload className="h-4 w-4" />
              Add Job Description
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-primary/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Integrate Job Description
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="job-description">Target Job Description</Label>
          <Textarea
            id="job-description"
            placeholder="Paste the complete job description here including requirements, responsibilities, and qualifications..."
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            className="min-h-[200px] resize-y"
            data-testid="textarea-job-description"
          />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileText className="h-3 w-3" />
            <span>{jobDescription.length} characters</span>
            {jobDescription.length > 500 && (
              <Badge variant="secondary" className="text-xs">Good length</Badge>
            )}
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            What will happen:
          </h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• AI will analyze the job requirements</li>
            <li>• Your CV will be enhanced with relevant keywords</li>
            <li>• New job matches will be generated</li>
            <li>• You'll see both original and enhanced results</li>
          </ul>
        </div>

        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => {
              setIsExpanded(false)
              setJobDescription('')
            }}
            disabled={integrateJDMutation.isPending}
            data-testid="button-cancel-jd"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleIntegrateJD}
            disabled={integrateJDMutation.isPending || !jobDescription.trim()}
            className="flex-1"
            data-testid="button-integrate-jd"
          >
            {integrateJDMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enhancing CV...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Integrate & Find Better Matches
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}