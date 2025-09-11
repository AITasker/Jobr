import { FeatureCard } from '@/components/FeatureCard'
import { Search, FileText, BarChart3, Brain, Target, Clock } from 'lucide-react'
import aiIllustration from '@assets/generated_images/AI_automation_process_illustration_76a2c317.png'

export function Features() {
  const features = [
    {
      icon: Target,
      title: 'Proactive Job Matching',
      description: 'Stop searching, start getting matched. Our AI scans major job boards 24/7 and delivers curated opportunities directly to your dashboard.',
      color: 'primary' as const
    },
    {
      icon: FileText,
      title: 'One-Click Applications',
      description: 'Apply with AI-powered confidence. Instantly tailor CVs and generate personalized cover letters with application readiness scores.',
      color: 'accent' as const
    },
    {
      icon: BarChart3,
      title: 'Smart Application Tracking',
      description: 'Never lose track again. Visual Kanban board with email open tracking so you know exactly when recruiters view your applications.',
      color: 'secondary' as const
    },
    {
      icon: Brain,
      title: 'AI Interview Preparation',
      description: 'We help you land the job. Get personalized interview questions, structured talking points, and practice sessions.',
      color: 'primary' as const
    }
  ]

  return (
    <section className="py-20 bg-muted/30" id="features">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-foreground sm:text-4xl mb-4">
            Four Pillars of Success
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Transform your job search from a manual grind into an intelligent, automated workflow
          </p>
        </div>

        {/* AI Illustration */}
        <div className="flex justify-center mb-16">
          <div className="relative max-w-md">
            <img
              src={aiIllustration}
              alt="AI automation process"
              className="w-full h-auto rounded-lg shadow-lg"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent rounded-lg" />
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <FeatureCard key={index} {...feature} />
          ))}
        </div>

        {/* Workflow Visual */}
        <div className="mt-16 text-center">
          <h3 className="text-2xl font-bold text-foreground mb-8">The Complete Workflow</h3>
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
            {['Discover', 'Apply', 'Track', 'Interview'].map((step, index) => (
              <div key={step} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                    {index + 1}
                  </div>
                  <span className="mt-2 text-sm font-medium text-foreground">{step}</span>
                </div>
                {index < 3 && (
                  <div className="hidden md:block w-16 h-0.5 bg-primary/30 mx-4" />
                )}
              </div>
            ))}
          </div>
          <p className="text-muted-foreground mt-6 max-w-2xl mx-auto">
            Each feature feeds into the next, creating a seamless ecosystem that becomes 
            indispensable for your career advancement journey.
          </p>
        </div>
      </div>
    </section>
  )
}