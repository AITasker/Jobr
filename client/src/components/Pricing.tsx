import { PricingCard } from '@/components/PricingCard'

export function Pricing() {
  const pricingPlans = [
    {
      title: 'Free Trial',
      price: 'Free',
      description: 'Try our AI job search platform with limited features',
      features: [
        '2 CV Downloads',
        'Basic Job Matching',
        'Application Tracking',
        'CV Upload & Analysis',
        'Community Support'
      ],
      buttonText: 'Start Free Trial',
      planId: 'free'
    },
    {
      title: 'Premium',
      price: '₹999',
      period: '/ month',
      description: 'Full access to AI-powered job search with ₹500 discount available',
      features: [
        'Unlimited CV Downloads',
        'AI-Enhanced Job Matching',
        'Job Description Integration',
        'Enhanced CV with JD',
        'Cover Letter Generation',
        'Email Open Tracking',
        'Priority Support',
        'Advanced Analytics'
      ],
      isPopular: true,
      buttonText: 'Go Premium',
      planId: 'premium'
    }
  ]

  return (
    <section className="py-20" id="pricing">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-foreground sm:text-4xl mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start free and upgrade as you land more interviews. No hidden fees, cancel anytime.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid gap-6 lg:grid-cols-2 max-w-4xl mx-auto">
          {pricingPlans.map((plan, index) => (
            <PricingCard key={index} {...plan} />
          ))}
        </div>

        {/* FAQ Note */}
        <div className="text-center mt-12">
          <p className="text-sm text-muted-foreground">
            Questions? <a href="#contact" className="text-primary hover:underline">Contact our team</a> for custom enterprise solutions
          </p>
        </div>
      </div>
    </section>
  )
}