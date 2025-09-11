import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MapPin, Clock, DollarSign, Building2 } from 'lucide-react'

interface JobCardProps {
  job: {
    id: string
    title: string
    company: string
    location: string
    type: string
    salary?: string
    postedDate: string
    matchScore: number
    description: string
    requirements: string[]
  }
  onApply?: (jobId: string) => void
  onSave?: (jobId: string) => void
}

export function JobCard({ job, onApply, onSave }: JobCardProps) {
  const handleApply = () => {
    console.log(`Applying to job: ${job.title}`)
    onApply?.(job.id)
  }

  const handleSave = () => {
    console.log(`Saving job: ${job.title}`)
    onSave?.(job.id)
  }

  const getMatchColor = (score: number) => {
    if (score >= 85) return 'bg-green-500'
    if (score >= 70) return 'bg-yellow-500'
    return 'bg-orange-500'
  }

  return (
    <Card className="h-full transition-all duration-200 hover-elevate" data-testid={`card-job-${job.id}`}>
      <CardContent className="p-6">
        {/* Header */}
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
            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-white ${getMatchColor(job.matchScore)}`}>
              <span data-testid={`match-score-${job.id}`}>{job.matchScore}%</span>
            </div>
          </div>
        </div>

        {/* Job Details */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span data-testid={`job-location-${job.id}`}>{job.location}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span data-testid={`job-posted-${job.id}`}>{job.postedDate}</span>
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

        {/* Description */}
        <p className="text-sm text-muted-foreground mb-4 line-clamp-3" data-testid={`job-description-${job.id}`}>
          {job.description}
        </p>

        {/* Requirements Preview */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-foreground mb-2">Key Requirements:</h4>
          <div className="flex flex-wrap gap-1">
            {job.requirements.slice(0, 3).map((req, index) => (
              <Badge key={index} variant="outline" className="text-xs" data-testid={`requirement-${job.id}-${index}`}>
                {req}
              </Badge>
            ))}
            {job.requirements.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{job.requirements.length - 3} more
              </Badge>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex gap-2 p-6 pt-0">
        <Button className="flex-1" onClick={handleApply} data-testid={`button-apply-${job.id}`}>
          Apply Now
        </Button>
        <Button variant="outline" onClick={handleSave} data-testid={`button-save-${job.id}`}>
          Save
        </Button>
      </CardFooter>
    </Card>
  )
}