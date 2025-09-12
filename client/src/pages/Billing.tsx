import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useQuery, useMutation } from '@tanstack/react-query'
import { apiRequest, queryClient } from '@/lib/queryClient'
import { useToast } from '@/hooks/use-toast'
import { CreditCard, Calendar, Users, Zap, BarChart3, MessageSquare, Crown } from 'lucide-react'

interface SubscriptionData {
  currentPlan: string
  subscriptionStatus: string
  currentPeriodEnd?: string
  applicationsThisMonth: number
  applicationsLimit: number
  stripeCustomerId?: string
  activeSubscription?: any
}

interface UsageStats {
  currentPlan: string
  applicationsThisMonth: number
  applicationLimit: number
  remainingApplications: number
  hasAIFeatures: boolean
  hasAdvancedAnalytics: boolean
  hasInterviewPrep: boolean
  daysSinceReset: number
  nextResetDate: string
}

export default function Billing() {
  const { user, isAuthenticated } = useAuth()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)

  // Fetch subscription data
  const { data: subscription, isLoading: subscriptionLoading } = useQuery<SubscriptionData>({
    queryKey: ['/api/subscription'],
    enabled: isAuthenticated,
  })

  // Fetch usage statistics
  const { data: usageStats, isLoading: usageLoading } = useQuery<UsageStats>({
    queryKey: ['/api/subscription/usage'],
    enabled: isAuthenticated,
  })

  // Cancel subscription mutation
  const cancelSubscription = useMutation({
    mutationFn: async (cancelAtPeriodEnd: boolean) => {
      return apiRequest('POST', '/api/subscription/cancel', { cancelAtPeriodEnd })
    },
    onSuccess: () => {
      toast({
        title: "Subscription Updated",
        description: "Your subscription has been updated successfully.",
      })
      queryClient.invalidateQueries({ queryKey: ['/api/subscription'] })
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update subscription. Please try again.",
        variant: "destructive",
      })
    },
  })

  // Create subscription (upgrade)
  const createSubscription = useMutation({
    mutationFn: async ({ plan, priceId }: { plan: string, priceId: string }) => {
      const response = await apiRequest('POST', '/api/subscription/create', { plan, priceId })
      const data = await response.json()
      return data
    },
    onSuccess: (data) => {
      // Redirect to Stripe Checkout
      if (data.sessionUrl) {
        window.location.href = data.sessionUrl
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start subscription. Please try again.",
        variant: "destructive",
      })
    },
  })

  const handleUpgrade = async (plan: string, priceId: string) => {
    setIsLoading(true)
    try {
      await createSubscription.mutateAsync({ plan, priceId })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancelSubscription = async () => {
    if (confirm('Are you sure you want to cancel your subscription? You will continue to have access until the end of your billing period.')) {
      await cancelSubscription.mutateAsync(true)
    }
  }

  const getPlanFeatures = (plan: string) => {
    switch (plan) {
      case 'Free':
        return [
          { icon: Users, text: '5 Applications per month', included: true },
          { icon: MessageSquare, text: 'Basic Job Matching', included: true },
          { icon: CreditCard, text: 'Application Tracking', included: true },
          { icon: Zap, text: 'AI-Generated Cover Letters', included: false },
          { icon: BarChart3, text: 'Advanced Analytics', included: false },
          { icon: Crown, text: 'Priority Support', included: false },
        ]
      case 'Premium':
        return [
          { icon: Users, text: 'Unlimited Applications', included: true },
          { icon: Zap, text: 'AI-Generated Cover Letters', included: true },
          { icon: MessageSquare, text: 'Advanced Job Matching', included: true },
          { icon: Crown, text: 'Priority Support', included: true },
          { icon: BarChart3, text: 'Advanced Analytics', included: false },
          { icon: MessageSquare, text: 'Interview Preparation', included: false },
        ]
      case 'Pro':
        return [
          { icon: Users, text: 'Unlimited Applications', included: true },
          { icon: Zap, text: 'AI-Generated Cover Letters', included: true },
          { icon: MessageSquare, text: 'Advanced Job Matching', included: true },
          { icon: Crown, text: 'Priority Support', included: true },
          { icon: BarChart3, text: 'Advanced Analytics', included: true },
          { icon: MessageSquare, text: 'Interview Preparation', included: true },
        ]
      default:
        return []
    }
  }

  if (!isAuthenticated) {
    return <div>Please log in to view billing information.</div>
  }

  if (subscriptionLoading || usageLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-64"></div>
          <div className="h-32 bg-muted rounded"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    )
  }

  const currentPlan = subscription?.currentPlan || 'Free'
  const usagePercentage = usageStats?.applicationLimit !== -1 
    ? Math.round((usageStats?.applicationsThisMonth || 0) / (usageStats?.applicationLimit || 1) * 100)
    : 0

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Billing & Subscription</h1>
        <p className="text-muted-foreground">Manage your subscription and view usage statistics</p>
      </div>

      {/* Current Plan Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Current Plan: {currentPlan}</span>
            <Badge variant={currentPlan === 'Free' ? 'secondary' : 'default'}>
              {currentPlan === 'Free' ? 'Free' : 'Paid'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {subscription?.subscriptionStatus && (
            <div className="mb-4">
              <p className="text-sm text-muted-foreground">
                Status: <span className="font-medium">{subscription.subscriptionStatus}</span>
              </p>
              {subscription.currentPeriodEnd && (
                <p className="text-sm text-muted-foreground">
                  Next billing: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          {/* Plan Features */}
          <div className="grid gap-2 mb-4">
            <h4 className="font-medium mb-2">Plan Features:</h4>
            {getPlanFeatures(currentPlan).map((feature, index) => (
              <div key={index} className="flex items-center gap-2">
                <feature.icon className={`h-4 w-4 ${feature.included ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className={`text-sm ${feature.included ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
                  {feature.text}
                </span>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {currentPlan === 'Free' && (
              <>
                <Button 
                  onClick={() => handleUpgrade('Premium', 'price_premium_monthly')}
                  disabled={isLoading}
                  data-testid="button-upgrade-premium"
                >
                  Upgrade to Premium ($19/month)
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => handleUpgrade('Pro', 'price_pro_monthly')}
                  disabled={isLoading}
                  data-testid="button-upgrade-pro"
                >
                  Upgrade to Pro ($49/month)
                </Button>
              </>
            )}
            {currentPlan === 'Premium' && (
              <>
                <Button 
                  onClick={() => handleUpgrade('Pro', 'price_pro_monthly')}
                  disabled={isLoading}
                  data-testid="button-upgrade-pro"
                >
                  Upgrade to Pro ($49/month)
                </Button>
                <Button 
                  variant="outline"
                  onClick={handleCancelSubscription}
                  disabled={isLoading}
                  data-testid="button-cancel-subscription"
                >
                  Cancel Subscription
                </Button>
              </>
            )}
            {currentPlan === 'Pro' && (
              <Button 
                variant="outline"
                onClick={handleCancelSubscription}
                disabled={isLoading}
                data-testid="button-cancel-subscription"
              >
                Cancel Subscription
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Usage Statistics Card */}
      {usageStats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Usage Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Application Usage */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Applications This Month</span>
                  <span className="text-sm text-muted-foreground">
                    {usageStats.applicationsThisMonth} / {usageStats.applicationLimit === -1 ? '∞' : usageStats.applicationLimit}
                  </span>
                </div>
                {usageStats.applicationLimit !== -1 && (
                  <Progress value={usagePercentage} className="h-2" data-testid="progress-applications" />
                )}
                {usageStats.remainingApplications !== -1 && usageStats.remainingApplications <= 2 && (
                  <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                    ⚠️ You have {usageStats.remainingApplications} applications remaining this month
                  </p>
                )}
              </div>

              {/* Reset Date */}
              <div className="text-sm text-muted-foreground">
                Usage resets on: {new Date(usageStats.nextResetDate).toLocaleDateString()}
              </div>

              {/* Feature Access */}
              <div className="pt-4 border-t">
                <h4 className="font-medium mb-2">Feature Access:</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={usageStats.hasAIFeatures ? 'text-green-600' : 'text-muted-foreground'}>
                      {usageStats.hasAIFeatures ? '✓' : '✗'} AI Features
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={usageStats.hasAdvancedAnalytics ? 'text-green-600' : 'text-muted-foreground'}>
                      {usageStats.hasAdvancedAnalytics ? '✓' : '✗'} Advanced Analytics
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={usageStats.hasInterviewPrep ? 'text-green-600' : 'text-muted-foreground'}>
                      {usageStats.hasInterviewPrep ? '✓' : '✗'} Interview Prep
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}