import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Crown, Zap, TrendingUp } from 'lucide-react'
import { useLocation } from 'wouter'

interface UpgradePromptProps {
  reason: string
  currentUsage?: number
  limit?: number
  feature?: string
  className?: string
}

export function UpgradePrompt({ 
  reason, 
  currentUsage, 
  limit, 
  feature,
  className = "" 
}: UpgradePromptProps) {
  const [, setLocation] = useLocation()

  const handleUpgrade = () => {
    setLocation('/billing')
  }

  const getIcon = () => {
    if (feature === 'ai') return Zap
    if (feature === 'analytics') return TrendingUp
    return Crown
  }

  const Icon = getIcon()

  return (
    <Card className={`border-amber-200 bg-amber-50 dark:bg-amber-950/10 dark:border-amber-800 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
          <Icon className="h-5 w-5" />
          Upgrade Required
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-amber-700 dark:text-amber-300 mb-2">
            {reason}
          </p>
          
          {currentUsage !== undefined && limit !== undefined && (
            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
              <Badge variant="outline" className="border-amber-300 text-amber-700 dark:text-amber-300">
                {currentUsage}/{limit} used
              </Badge>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button 
            onClick={handleUpgrade}
            className="flex-1"
            data-testid="button-upgrade-prompt"
          >
            Upgrade to Premium ($19/month)
          </Button>
          <Button 
            variant="outline"
            onClick={handleUpgrade}
            className="flex-1"
            data-testid="button-upgrade-pro-prompt"
          >
            Go Pro ($49/month)
          </Button>
        </div>

        <div className="text-xs text-amber-600 dark:text-amber-400">
          ✨ Unlock unlimited applications, AI features, and priority support
        </div>
      </CardContent>
    </Card>
  )
}