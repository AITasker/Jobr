import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sparkles, ArrowRight, Play } from 'lucide-react'
import heroImage from '@assets/generated_images/Career_professionals_working_hero_image_fc5117a4.png'

export function Hero() {
  const handleGetStarted = () => {
    console.log('Get started clicked')
  }

  const handleWatchDemo = () => {
    console.log('Watch demo clicked')
  }

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-background to-muted/30 py-20 md:py-32">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 opacity-10">
        <img
          src={heroImage}
          alt="Career professionals working"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/60 to-background/90" />
      </div>

      <div className="container relative mx-auto px-4">
        <div className="mx-auto max-w-4xl text-center">
          {/* Badge */}
          <Badge variant="secondary" className="mb-6 inline-flex items-center gap-2 px-4 py-2" data-testid="badge-announcement">
            <Sparkles className="h-3 w-3" />
            <span>AI-Powered Job Search Revolution</span>
          </Badge>

          {/* Main Heading */}
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            Your AI-Powered
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent"> Job Search</span>
            Partner
          </h1>

          {/* Description */}
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            Stop the manual grind. Transform your job search with AI that matches you with perfect roles, 
            tailors your applications, and tracks your progress—all in minutes, not hours.
          </p>

          {/* Stats */}
          <div className="mt-8 grid grid-cols-3 gap-4 sm:gap-8 md:gap-12">
            <div>
              <div className="text-2xl font-bold text-primary sm:text-3xl" data-testid="stat-time-saved">10x</div>
              <div className="text-sm text-muted-foreground">Faster Applications</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary sm:text-3xl" data-testid="stat-match-rate">92%</div>
              <div className="text-sm text-muted-foreground">Match Accuracy</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary sm:text-3xl" data-testid="stat-users">5K+</div>
              <div className="text-sm text-muted-foreground">Dream Jobs Landed</div>
            </div>
          </div>

          {/* CTAs */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
              onClick={handleGetStarted}
              className="flex items-center gap-2 px-8"
              data-testid="button-get-started"
            >
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={handleWatchDemo}
              className="flex items-center gap-2 px-8"
              data-testid="button-watch-demo"
            >
              <Play className="h-4 w-4" />
              Watch Demo
            </Button>
          </div>

          {/* Social Proof */}
          <p className="mt-8 text-sm text-muted-foreground">
            Trusted by professionals at Google, Microsoft, Meta, and 500+ companies
          </p>
        </div>
      </div>
    </section>
  )
}