import { Card, CardContent } from '@/components/ui/card'
import { LucideIcon } from 'lucide-react'

interface FeatureCardProps {
  icon: LucideIcon
  title: string
  description: string
  color?: 'primary' | 'accent' | 'secondary'
}

export function FeatureCard({ icon: Icon, title, description, color = 'primary' }: FeatureCardProps) {
  const colorClasses = {
    primary: 'text-primary bg-primary/10',
    accent: 'text-accent-foreground bg-accent/20',
    secondary: 'text-muted-foreground bg-secondary'
  }

  return (
    <Card className="group h-full transition-all duration-200 hover-elevate" data-testid={`card-feature-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardContent className="p-6">
        <div className={`inline-flex rounded-lg p-3 ${colorClasses[color]} mb-4`}>
          <Icon className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
        <p className="text-muted-foreground leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  )
}