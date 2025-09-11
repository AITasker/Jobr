import { CVUpload } from '../CVUpload'
import { ThemeProvider } from '../ThemeProvider'

export default function CVUploadExample() {
  const handleUploadComplete = (cvData: any) => {
    console.log('CV upload completed:', cvData)
  }

  return (
    <ThemeProvider>
      <div className="p-6 max-w-2xl mx-auto">
        <CVUpload onUploadComplete={handleUploadComplete} />
      </div>
    </ThemeProvider>
  )
}