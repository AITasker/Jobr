import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useQuery } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { QrCode, Download, Zap, BarChart3, MessageSquare, Crown } from 'lucide-react'

interface UserData {
  id: string
  email: string
  plan: string
  applicationsThisMonth: number
}

interface UsageStats {
  currentPlan: string
  cvDownloadsThisMonth: number
  cvDownloadLimit: number
  remainingDownloads: number
  hasFullAccess: boolean
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

  const [showUpiPayment, setShowUpiPayment] = useState(false)

  const handlePaymentSuccess = () => {
    toast({
      title: "Payment Instructions Sent!",
      description: "Please complete the UPI payment. Your plan will be upgraded once payment is confirmed.",
      variant: "default",
    })
    setShowUpiPayment(false)
  }

  const getPlanFeatures = (plan: string) => {
    switch (plan) {
      case 'Free':
        return [
          { icon: Download, text: '2 CV Downloads per month', included: true },
          { icon: MessageSquare, text: 'Basic Job Search', included: true },
          { icon: Zap, text: 'AI-Powered Job Matching', included: false },
          { icon: BarChart3, text: 'Application Analytics', included: false },
          { icon: Crown, text: 'Priority Support', included: false },
          { icon: MessageSquare, text: 'Unlimited Applications', included: false },
        ]
      case 'Premium':
        return [
          { icon: Download, text: 'Unlimited CV Downloads', included: true },
          { icon: MessageSquare, text: 'Unlimited Job Applications', included: true },
          { icon: Zap, text: 'AI-Powered Job Matching', included: true },
          { icon: BarChart3, text: 'Application Analytics', included: true },
          { icon: Crown, text: 'Priority Support', included: true },
          { icon: MessageSquare, text: 'AI Cover Letter Generation', included: true },
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
  const usagePercentage = usageStats?.cvDownloadLimit !== -1 
    ? Math.round((usageStats?.cvDownloadsThisMonth || 0) / (usageStats?.cvDownloadLimit || 1) * 100)
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

          {/* Payment Section */}
          <div className="space-y-4">
            {currentPlan === 'Free' && (
              <div className="space-y-4">
                <div className="border rounded-lg p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
                  <h4 className="font-medium text-lg mb-2">Upgrade to Premium - ₹999/month</h4>
                  <p className="text-sm text-muted-foreground mb-4">Get unlimited access to all features</p>
                  
                  {showUpiPayment ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-center p-6 border-2 border-dashed border-primary rounded-lg bg-background">
                        <div className="text-center">
                          <QrCode className="h-24 w-24 mx-auto mb-4 text-primary" />
                          <p className="text-lg font-medium mb-2">Scan & Pay ₹999</p>
                          <p className="text-sm text-muted-foreground mb-4">
                            Scan this QR code with any UPI app to complete payment
                          </p>
                          <div className="text-xs text-muted-foreground">
                            <p>Payment ID: UPI-{Date.now()}</p>
                            <p>Amount: ₹999.00</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          onClick={() => setShowUpiPayment(false)}
                          data-testid="button-cancel-payment"
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={handlePaymentSuccess}
                          data-testid="button-payment-completed"
                        >
                          I've Completed Payment
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button 
                      onClick={() => setShowUpiPayment(true)}
                      data-testid="button-upgrade-premium"
                      className="w-full"
                    >
                      <QrCode className="h-4 w-4 mr-2" />
                      Pay ₹999 with UPI
                    </Button>
                  )}
                </div>
              </div>
            )}
            
            {currentPlan === 'Premium' && (
              <div className="text-center p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-lg border">
                <Crown className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
                <h4 className="font-medium text-lg mb-2">Premium Plan Active</h4>
                <p className="text-muted-foreground">You have access to all premium features!</p>
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
              {/* CV Download Usage */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">CV Downloads This Month</span>
                  <span className="text-sm text-muted-foreground">
                    {usageStats.cvDownloadsThisMonth} / {usageStats.cvDownloadLimit === -1 ? '∞' : usageStats.cvDownloadLimit}
                  </span>
                </div>
                {usageStats.cvDownloadLimit !== -1 && (
                  <Progress value={usagePercentage} className="h-2" data-testid="progress-downloads" />
                )}
                {usageStats.remainingDownloads !== -1 && usageStats.remainingDownloads <= 1 && (
                  <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                    ⚠️ You have {usageStats.remainingDownloads} CV downloads remaining this month
                  </p>
                )}
              </div>

              {/* Reset Date */}
              <div className="text-sm text-muted-foreground">
                Usage resets on: {new Date(usageStats.nextResetDate).toLocaleDateString()}
              </div>

              {/* Feature Access */}
              <div className="pt-4 border-t">
                <h4 className="font-medium mb-2">Current Plan Features:</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={currentPlan === 'Premium' ? 'text-green-600' : 'text-muted-foreground'}>
                      {currentPlan === 'Premium' ? '✓' : '✗'} Unlimited CV Downloads
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={currentPlan === 'Premium' ? 'text-green-600' : 'text-muted-foreground'}>
                      {currentPlan === 'Premium' ? '✓' : '✗'} AI-Powered Job Matching
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={currentPlan === 'Premium' ? 'text-green-600' : 'text-muted-foreground'}>
                      {currentPlan === 'Premium' ? '✓' : '✗'} Application Analytics
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={currentPlan === 'Premium' ? 'text-green-600' : 'text-muted-foreground'}>
                      {currentPlan === 'Premium' ? '✓' : '✗'} Priority Support
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