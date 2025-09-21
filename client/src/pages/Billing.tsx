import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useQuery } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { CreditCard, Calendar, Users, Zap, BarChart3, MessageSquare, Crown } from 'lucide-react'
import PayPalButton from '@/components/PayPalButton'

interface UserData {
  id: string
  email: string
  plan: string
  applicationsThisMonth: number
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

  // Fetch usage statistics from subscription service
  const { data: usageStats, isLoading: usageLoading } = useQuery<UsageStats>({
    queryKey: ['/api/subscription/usage'],
    enabled: isAuthenticated,
  })

  const [showPayPal, setShowPayPal] = useState<string | null>(null)

  const getPlanPrice = (plan: string) => {
    switch (plan) {
      case 'Premium':
        return { amount: '499', currency: 'INR', priceDisplay: '₹499/month' }
      case 'Pro':
        return { amount: '999', currency: 'INR', priceDisplay: '₹999/month' }
      default:
        return { amount: '0', currency: 'INR', priceDisplay: 'Free' }
    }
  }

  const handlePaymentSuccess = (plan: string) => {
    toast({
      title: "Payment Successful!",
      description: `You have successfully upgraded to ${plan}. Your new features will be available shortly.`,
      variant: "default",
    })
    // In a real app, you would update the user's subscription status
    setShowPayPal(null)
  }

  const handlePaymentError = () => {
    toast({
      title: "Payment Failed",
      description: "There was an issue processing your payment. Please try again.",
      variant: "destructive",
    })
    setShowPayPal(null)
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

  if (usageLoading) {
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

  const currentPlan = usageStats?.currentPlan || (user as any)?.plan || 'Free'
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
          <div className="space-y-4">
            {currentPlan === 'Free' && (
              <div className="grid gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Upgrade to Premium (₹499/month)</h4>
                  {showPayPal === 'Premium' ? (
                    <div className="flex gap-2 items-center">
                      <PayPalButton 
                        amount={getPlanPrice('Premium').amount}
                        currency={getPlanPrice('Premium').currency}
                        intent="capture"
                      />
                      <Button 
                        variant="outline" 
                        onClick={() => setShowPayPal(null)}
                        data-testid="button-cancel-payment"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      onClick={() => setShowPayPal('Premium')}
                      data-testid="button-upgrade-premium"
                    >
                      Pay with PayPal - ₹499/month
                    </Button>
                  )}
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium">Upgrade to Pro (₹999/month)</h4>
                  {showPayPal === 'Pro' ? (
                    <div className="flex gap-2 items-center">
                      <PayPalButton 
                        amount={getPlanPrice('Pro').amount}
                        currency={getPlanPrice('Pro').currency}
                        intent="capture"
                      />
                      <Button 
                        variant="outline" 
                        onClick={() => setShowPayPal(null)}
                        data-testid="button-cancel-payment"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      variant="outline"
                      onClick={() => setShowPayPal('Pro')}
                      data-testid="button-upgrade-pro"
                    >
                      Pay with PayPal - ₹999/month
                    </Button>
                  )}
                </div>
              </div>
            )}
            
            {currentPlan === 'Premium' && (
              <div className="space-y-2">
                <h4 className="font-medium">Upgrade to Pro (₹999/month)</h4>
                {showPayPal === 'Pro' ? (
                  <div className="flex gap-2 items-center">
                    <PayPalButton 
                      amount={getPlanPrice('Pro').amount}
                      currency={getPlanPrice('Pro').currency}
                      intent="capture"
                    />
                    <Button 
                      variant="outline" 
                      onClick={() => setShowPayPal(null)}
                      data-testid="button-cancel-payment"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button 
                    onClick={() => setShowPayPal('Pro')}
                    data-testid="button-upgrade-pro"
                  >
                    Pay with PayPal - ₹999/month
                  </Button>
                )}
              </div>
            )}
            
            {currentPlan === 'Pro' && (
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-muted-foreground">You're on the highest tier! Enjoying all premium features.</p>
              </div>
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