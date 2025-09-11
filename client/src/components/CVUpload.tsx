import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface CVUploadProps {
  onUploadComplete?: (cvData: any) => void
}

interface UploadResponse {
  success: boolean
  cv: any
  parsedData: any
  processingMethod: 'openai' | 'fallback'
  message: string
}

export function CVUpload({ onUploadComplete }: CVUploadProps) {
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'completed' | 'error'>('idle')
  const [progress, setProgress] = useState(0)
  const [fileName, setFileName] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [processingMethod, setProcessingMethod] = useState<'openai' | 'fallback' | null>(null)
  const { toast } = useToast()

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file before upload
    const maxSize = 5 * 1024 * 1024 // 5MB
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    
    if (file.size > maxSize) {
      setErrorMessage('File size exceeds 5MB limit')
      setUploadStatus('error')
      return
    }

    if (!allowedTypes.includes(file.type)) {
      setErrorMessage('Please upload a PDF, DOC, or DOCX file')
      setUploadStatus('error')
      return
    }

    setFileName(file.name)
    setUploadStatus('uploading')
    setProgress(0)
    setErrorMessage('')
    setProcessingMethod(null)

    try {
      // Create FormData for file upload
      const formData = new FormData()
      formData.append('cv', file)

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 100)

      // Upload file to backend
      const response = await fetch('/api/cv/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      })

      clearInterval(progressInterval)
      setProgress(100)
      setUploadStatus('processing')

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `Upload failed with status ${response.status}`)
      }

      const result: UploadResponse = await response.json()
      
      // Show completion after brief processing animation
      setTimeout(() => {
        setUploadStatus('completed')
        setProcessingMethod(result.processingMethod)
        
        // Show appropriate toast message
        if (result.processingMethod === 'openai') {
          toast({
            title: "CV Processed Successfully!",
            description: "Your CV has been analyzed with AI and is ready for job matching.",
          })
        } else {
          toast({
            title: "CV Uploaded",
            description: "Your CV has been processed with basic parsing. Full AI analysis is temporarily unavailable.",
            variant: "default"
          })
        }
        
        // Call completion handler with parsed data
        if (onUploadComplete && result.parsedData) {
          onUploadComplete(result.parsedData)
        }
      }, 1500)
      
    } catch (error) {
      console.error('Upload error:', error)
      setUploadStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Upload failed unexpectedly')
      
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive"
      })
    }
  }

  const handleReUpload = () => {
    setUploadStatus('idle')
    setProgress(0)
    setFileName('')
    setErrorMessage('')
    setProcessingMethod(null)
    
    // Reset file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    if (fileInput) {
      fileInput.value = ''
    }
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
        if (processingMethod === 'openai') {
          return 'CV analyzed with AI successfully!'
        } else if (processingMethod === 'fallback') {
          return 'CV processed (basic parsing)'
        }
        return 'CV processed successfully!'
      case 'error':
        return errorMessage || 'Upload failed. Please try again.'
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
            <div className="text-sm text-muted-foreground space-y-2">
              {processingMethod === 'openai' ? (
                <p>Your CV has been analyzed with AI and is ready for job matching!</p>
              ) : processingMethod === 'fallback' ? (
                <div>
                  <p>Your CV has been processed with basic parsing.</p>
                  <p className="text-xs text-yellow-600 dark:text-yellow-500">
                    AI analysis is currently unavailable, but you can still use the platform.
                  </p>
                </div>
              ) : (
                <p>Your CV has been processed and is ready for job matching!</p>
              )}
            </div>
            <Button variant="outline" onClick={handleReUpload} data-testid="button-upload-new-cv">
              Upload New CV
            </Button>
          </div>
        )}

        {uploadStatus === 'error' && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground space-y-1">
              <p>There was an error processing your CV:</p>
              <p className="text-xs text-red-600 dark:text-red-500 bg-red-50 dark:bg-red-950 p-2 rounded">
                {errorMessage || 'Unknown error occurred'}
              </p>
            </div>
            <Button onClick={handleReUpload} data-testid="button-retry-upload">
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}