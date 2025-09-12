import { PricingCard } from '@/components/PricingCard'

export function Pricing() {
  const pricingPlans = [
    {
      title: 'Free',
      price: 'Free',
      description: 'Perfect for getting started with AI job search',
      features: [
        '5 Applications per month',
        'Basic Job Matching',
        'Application Tracking',
        'CV Upload & Analysis',
        'Community Support'
      ],
      buttonText: 'Start Free',
      planId: 'free'
    },
    {
      title: 'Premium',
      price: '$19',
      period: '/ month',
      description: 'For active job seekers who want unlimited access',
      features: [
        'Unlimited Applications',
        'AI-Generated Cover Letters',
        'Advanced Job Matching',
        'Email Open Tracking',
        'Priority Support',
        'Custom CV Tailoring'
      ],
      isPopular: true,
      buttonText: 'Go Premium',
      planId: 'premium'
    },
    {
      title: 'Pro',
      price: '$49',
      period: '/ month',
      description: 'Complete career advancement toolkit',
      features: [
        'Everything in Premium',
        'Advanced Analytics Dashboard',
        'AI Interview Preparation',
        'Premium Cover Letter Templates',
        'Career Path Planning',
        'Dedicated Support',
        'Priority Job Matching'
      ],
      buttonText: 'Go Pro',
      planId: 'pro'
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
        <div className="grid gap-6 lg:grid-cols-3 max-w-6xl mx-auto">
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