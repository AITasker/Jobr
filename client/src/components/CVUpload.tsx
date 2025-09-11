import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react'

interface CVUploadProps {
  onUploadComplete?: (cvData: any) => void
}

export function CVUpload({ onUploadComplete }: CVUploadProps) {
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'completed' | 'error'>('idle')
  const [progress, setProgress] = useState(0)
  const [fileName, setFileName] = useState('')

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setUploadStatus('uploading')
    setProgress(0)

    // Simulate upload progress
    const uploadInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(uploadInterval)
          setUploadStatus('processing')
          
          // Simulate AI processing
          setTimeout(() => {
            setUploadStatus('completed')
            // todo: remove mock functionality
            const mockCVData = {
              name: 'Sarah Johnson',
              email: 'sarah@example.com',
              skills: ['React', 'TypeScript', 'Node.js', 'Python'],
              experience: '5 years',
              education: 'Computer Science, IIT Delhi'
            }
            onUploadComplete?.(mockCVData)
          }, 2000)
          
          return 100
        }
        return prev + 10
      })
    }, 200)
  }

  const handleReUpload = () => {
    setUploadStatus('idle')
    setProgress(0)
    setFileName('')
  }

  const getStatusIcon = () => {
    switch (uploadStatus) {
      case 'completed':
        return <CheckCircle className="h-8 w-8 text-green-500" />
      case 'error':
        return <AlertCircle className="h-8 w-8 text-red-500" />
      case 'processing':
        return <div className="h-8 w-8 animate-spin border-2 border-primary border-t-transparent rounded-full" />
      default:
        return <FileText className="h-8 w-8 text-muted-foreground" />
    }
  }

  const getStatusText = () => {
    switch (uploadStatus) {
      case 'uploading':
        return 'Uploading your CV...'
      case 'processing':
        return 'AI is analyzing your CV...'
      case 'completed':
        return 'CV processed successfully!'
      case 'error':
        return 'Upload failed. Please try again.'
      default:
        return 'Upload your CV to get started'
    }
  }

  if (uploadStatus === 'idle') {
    return (
      <Card className="border-dashed border-2 border-muted-foreground/25 hover:border-primary/50 transition-colors">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Upload className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Upload Your CV</h3>
          <p className="text-muted-foreground mb-6 max-w-sm">
            Upload your CV and our AI will analyze it to match you with perfect job opportunities
          </p>
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleFileSelect}
              className="sr-only"
              data-testid="input-cv-upload"
            />
            <Button className="flex items-center gap-2" data-testid="button-upload-cv">
              <Upload className="h-4 w-4" />
              Choose File
            </Button>
          </label>
          <p className="text-xs text-muted-foreground mt-3">
            Supported formats: PDF, DOC, DOCX (Max 5MB)
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        {getStatusIcon()}
        <h3 className="text-lg font-semibold text-foreground mt-4 mb-2" data-testid="upload-status-text">
          {getStatusText()}
        </h3>
        
        {fileName && (
          <p className="text-sm text-muted-foreground mb-4" data-testid="uploaded-filename">
            {fileName}
          </p>
        )}

        {(uploadStatus === 'uploading' || uploadStatus === 'processing') && (
          <div className="w-full max-w-xs mb-4">
            <Progress value={progress} className="h-2" data-testid="upload-progress" />
            <p className="text-xs text-muted-foreground mt-2">{progress}% complete</p>
          </div>
        )}

        {uploadStatus === 'completed' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Your CV has been processed and is ready for job matching!
            </p>
            <Button variant="outline" onClick={handleReUpload} data-testid="button-upload-new-cv">
              Upload New CV
            </Button>
          </div>
        )}

        {uploadStatus === 'error' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              There was an error processing your CV. Please try again.
            </p>
            <Button onClick={handleReUpload} data-testid="button-retry-upload">
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}