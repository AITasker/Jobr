import { FeatureCard } from '../FeatureCard'
import { ThemeProvider } from '../ThemeProvider'
import { Search, FileText, BarChart3, Brain } from 'lucide-react'

export default function FeatureCardExample() {
  return (
    <ThemeProvider>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 p-6">
        <FeatureCard
          icon={Search}
          title="Smart Job Matching"
          description="AI scans job boards 24/7 to find roles perfectly matched to your profile"
          color="primary"
        />
        <FeatureCard
          icon={FileText}
          title="One-Click Applications"
          description="Instantly generate tailored CVs and cover letters for each application"
          color="accent"
        />
        <FeatureCard
          icon={BarChart3}
          title="Application Tracking"
          description="Visual dashboard to track all applications with email open notifications"
          color="secondary"
        />
        <FeatureCard
          icon={Brain}
          title="AI Interview Prep"
          description="Practice with personalized questions and talking points from your experience"
          color="primary"
        />
      </div>
    </ThemeProvider>
  )
}