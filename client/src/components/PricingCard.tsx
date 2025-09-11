import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check } from 'lucide-react'

interface PricingCardProps {
  title: string
  price: string
  period?: string
  description: string
  features: string[]
  isPopular?: boolean
  buttonText?: string
  onSelect?: () => void
}

export function PricingCard({ 
  title, 
  price, 
  period = '/ month', 
  description, 
  features, 
  isPopular = false,
  buttonText = 'Get Started',
  onSelect
}: PricingCardProps) {
  const handleSelect = () => {
    console.log(`${title} plan selected`)
    onSelect?.()
  }

  return (
    <Card className={`relative h-full transition-all duration-200 hover-elevate ${
      isPopular ? 'ring-2 ring-primary' : ''
    }`} data-testid={`card-pricing-${title.toLowerCase()}`}>
      {isPopular && (
        <Badge 
          className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground"
          data-testid="badge-most-popular"
        >
          Most Popular
        </Badge>
      )}
      
      <CardHeader className="text-center pb-2">
        <h3 className="text-xl font-semibold text-foreground">{title}</h3>
        <div className="mt-2">
          <span className="text-4xl font-bold text-foreground" data-testid={`price-${title.toLowerCase()}`}>
            {price}
          </span>
          {price !== 'Free' && <span className="text-muted-foreground">{period}</span>}
        </div>
        <p className="text-sm text-muted-foreground mt-2">{description}</p>
      </CardHeader>

      <CardContent className="flex-1">
        <ul className="space-y-3">
          {features.map((feature, index) => (
            <li 
              key={index} 
              className="flex items-start gap-3"
              data-testid={`feature-${title.toLowerCase()}-${index}`}
            >
              <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <span className="text-sm text-muted-foreground">{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter>
        <Button 
          className="w-full"
          variant={isPopular ? 'default' : 'outline'}
          onClick={handleSelect}
          data-testid={`button-select-${title.toLowerCase()}`}
        >
          {buttonText}
        </Button>
      </CardFooter>
    </Card>
  )
}