import { PricingCard } from '@/components/PricingCard'

export function Pricing() {
  const pricingPlans = [
    {
      title: 'Explorer',
      price: 'Free',
      description: 'Perfect for getting started with AI job search',
      features: [
        '3 Full Application Credits',
        'Job Matching Alerts',
        'Basic Application Tracking',
        'Community Support',
        'CV Analysis & Feedback'
      ],
      buttonText: 'Start Free'
    },
    {
      title: 'Applicant',
      price: '₹249',
      description: 'For active job seekers who want unlimited access',
      features: [
        'Unlimited Applications',
        'Advanced Job Matching',
        'Application Tracking Board',
        'Email Open Tracking',
        'Priority Support',
        'Custom Cover Letter Templates'
      ],
      isPopular: true,
      buttonText: 'Go Premium'
    },
    {
      title: 'Strategist',
      price: '₹499',
      description: 'Complete career advancement toolkit',
      features: [
        'Everything in Applicant',
        'AI Interview Prep Module',
        'Advanced Analytics',
        'Career Path Planning',
        'Salary Negotiation Tools',
        'Dedicated Career Advisor',
        'Priority Job Matching'
      ],
      buttonText: 'Go Pro'
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