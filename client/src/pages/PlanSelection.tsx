import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useLocation } from 'wouter'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { QrCode, Download, Zap, Check, Crown, Loader2, ArrowLeft } from 'lucide-react'
import { apiRequest } from '@/lib/queryClient'

interface UpiPayment {
  id: string
  amount: number
  status: 'pending' | 'completed' | 'failed'
  merchantTransactionId?: string
  paymentUrl?: string
  qrCode: {
    upiId: string
    amount: number
    transactionNote: string
    merchantCode: string
  }
}

export default function PlanSelection() {
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [, setLocation] = useLocation()
  
  const [selectedPlan, setSelectedPlan] = useState<'Free' | 'Premium' | null>(null)
  const [currentPayment, setCurrentPayment] = useState<UpiPayment | null>(null)
  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null)

  // Activate free trial mutation
  const activateFreeMutation = useMutation({
    mutationFn: async () => {
      const data = await apiRequest('POST', '/api/subscription/activate-free')
      if (!data.success) throw new Error(data.message)
      return data
    },
    onSuccess: () => {
      toast({
        title: "Free Trial Activated!",
        description: "You can now download up to 2 CVs per month.",
      })
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] })
      setLocation('/dashboard')
    },
    onError: (error: any) => {
      toast({
        variant: "destructive", 
        title: "Activation Failed",
        description: error.message || "Failed to activate free trial. Please try again.",
      })
    }
  })

  // Create UPI payment mutation
  const createPaymentMutation = useMutation({
    mutationFn: async () => {
      const data = await apiRequest('POST', '/api/payments/upi/create', {
        plan: 'Premium',
        couponCode: couponCode.trim() || undefined
      })
      if (!data.success) throw new Error(data.message)
      return data.payment
    },
    onSuccess: (payment) => {
      setCurrentPayment(payment)
      if (couponCode.trim()) {
        setAppliedCoupon(couponCode.trim())
      }
      toast({
        title: "Payment Created!",
        description: "Use the UPI QR code below to complete your payment.",
      })
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Payment Failed",
        description: error.message || "Failed to create payment. Please try again.",
      })
    }
  })

  const handlePlanSelection = (plan: 'Free' | 'Premium') => {
    setSelectedPlan(plan)
    
    if (plan === 'Free') {
      activateFreeMutation.mutate()
    } else {
      // Show premium payment options
      setSelectedPlan('Premium')
    }
  }

  const handlePremiumPayment = () => {
    createPaymentMutation.mutate()
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied!",
      description: "UPI ID copied to clipboard",
    })
  }

  // If payment is created, show payment screen
  if (currentPayment) {
    const finalAmount = appliedCoupon ? 499 : 999

    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="text-center mb-8">
          <Crown className="h-12 w-12 mx-auto mb-4 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Complete Your Premium Subscription</h1>
          <p className="text-muted-foreground mt-2">
            Scan the QR code below or use the UPI ID to pay ₹{finalAmount}
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              UPI Payment Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted rounded-lg p-4 text-center">
              <div className="text-2xl font-bold mb-4 text-primary">Scan QR Code</div>
              <p className="text-sm text-muted-foreground mb-2">
                Open any UPI app and scan QR code or use UPI ID below
              </p>
              <Button
                variant="outline"
                onClick={() => copyToClipboard(currentPayment.qrCode.upiId)}
                className="mb-2"
                data-testid="button-copy-upi"
              >
                {currentPayment.qrCode.upiId}
              </Button>
              <p className="text-2xl font-bold text-primary">₹{finalAmount}</p>
              {appliedCoupon && (
                <Badge variant="secondary" className="mt-2">
                  Coupon Applied: {appliedCoupon} (₹500 off)
                </Badge>
              )}
            </div>

            <div className="text-center space-y-2">
              <p className="text-sm font-medium">Transaction Note:</p>
              <p className="text-sm text-muted-foreground bg-muted rounded px-3 py-1">
                {currentPayment.qrCode.transactionNote}
              </p>
            </div>

            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                After payment, your Premium subscription will be activated automatically.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button 
            variant="outline" 
            onClick={() => setCurrentPayment(null)}
            data-testid="button-back"
          >
            ← Back to Plan Selection
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <Button 
          variant="ghost" 
          onClick={() => setLocation('/dashboard')}
          className="flex items-center gap-2"
          data-testid="button-continue-dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
          Continue to Dashboard
        </Button>
      </div>
      
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-4">Choose Your Plan</h1>
        <p className="text-muted-foreground text-lg">
          Start your job search journey with the perfect plan for your needs
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Free Trial Plan */}
        <Card className={`relative ${selectedPlan === 'Free' ? 'ring-2 ring-primary' : ''}`}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Free Trial
              </CardTitle>
              <Badge variant="secondary">Perfect for testing</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">₹0</div>
              <p className="text-muted-foreground">Get started for free</p>
            </div>

            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-sm">2 CV downloads per month</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-sm">Basic job matching</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-sm">AI-powered CV optimization</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-sm">Application tracking</span>
              </li>
            </ul>

            <Button 
              className="w-full" 
              variant="outline"
              onClick={() => handlePlanSelection('Free')}
              disabled={activateFreeMutation.isPending}
              data-testid="button-select-free"
            >
              {activateFreeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Activating...
                </>
              ) : (
                'Start Free Trial'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Premium Plan */}
        <Card className={`relative ${selectedPlan === 'Premium' ? 'ring-2 ring-primary' : ''} border-primary/50`}>
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
            <Badge className="bg-primary text-primary-foreground">
              <Crown className="h-3 w-3 mr-1" />
              Most Popular
            </Badge>
          </div>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Premium
              </CardTitle>
              <Badge variant="default">Unlimited power</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">₹999</div>
              <p className="text-muted-foreground">per month</p>
            </div>

            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">Unlimited CV downloads</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-sm">Advanced AI job matching</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-sm">Premium CV templates</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-sm">Priority application processing</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-sm">Email integration & tracking</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-sm">Interview preparation tools</span>
              </li>
            </ul>

            <Button 
              className="w-full" 
              onClick={() => setSelectedPlan('Premium')}
              disabled={selectedPlan === 'Premium' && !currentPayment}
              data-testid="button-select-premium"
            >
              Choose Premium
            </Button>

            {selectedPlan === 'Premium' && !currentPayment && (
              <div className="space-y-4 border-t pt-4">
                <div className="space-y-2">
                  <Label htmlFor="coupon">Coupon Code (Optional)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="coupon"
                      placeholder="Enter coupon code"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      data-testid="input-coupon"
                    />
                  </div>
                  {couponCode.trim() && (
                    <p className="text-sm text-muted-foreground">
                      Final amount: ₹{couponCode.trim().toUpperCase() === 'SAVE500' ? '499' : '999'}
                    </p>
                  )}
                </div>

                <Button 
                  onClick={handlePremiumPayment}
                  disabled={createPaymentMutation.isPending}
                  className="w-full"
                  data-testid="button-create-payment"
                >
                  {createPaymentMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Payment...
                    </>
                  ) : (
                    <>
                      <QrCode className="mr-2 h-4 w-4" />
                      Pay with UPI
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="text-center text-sm text-muted-foreground">
        <p>All payments are processed securely through UPI</p>
        <p>Your subscription can be cancelled anytime</p>
      </div>
    </div>
  )
}