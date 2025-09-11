import { PricingCard } from '../PricingCard'
import { ThemeProvider } from '../ThemeProvider'

export default function PricingCardExample() {
  // todo: remove mock functionality
  const pricingPlans = [
    {
      title: 'Explorer',
      price: 'Free',
      description: 'Perfect for getting started with AI job search',
      features: [
        '3 Full Application Credits',
        'Job Matching Alerts',
        'Basic Application Tracking',
        'Community Support'
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
        'Priority Support'
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
        'Dedicated Career Advisor'
      ],
      buttonText: 'Go Pro'
    }
  ]

  return (
    <ThemeProvider>
      <div className="grid gap-6 md:grid-cols-3 p-6">
        {pricingPlans.map((plan, index) => (
          <PricingCard key={index} {...plan} />
        ))}
      </div>
    </ThemeProvider>
  )
}