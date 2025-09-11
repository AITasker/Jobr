import { ApplicationTracker } from '../ApplicationTracker'
import { ThemeProvider } from '../ThemeProvider'

export default function ApplicationTrackerExample() {
  // todo: remove mock functionality
  const mockApplications = [
    {
      id: '1',
      jobTitle: 'Senior Frontend Developer',
      company: 'TechCorp Solutions',
      appliedDate: '3 days ago',
      status: 'interviewing' as const,
      matchScore: 92,
      emailOpened: true,
      interviewDate: 'Tomorrow, 3:00 PM',
      notes: 'Great company culture, exciting project opportunities'
    },
    {
      id: '2',
      jobTitle: 'Product Designer',
      company: 'Design Studio',
      appliedDate: '1 week ago',
      status: 'viewed' as const,
      matchScore: 78,
      emailOpened: true,
      notes: 'Waiting for design challenge response'
    },
    {
      id: '3',
      jobTitle: 'Full Stack Engineer',
      company: 'StartupXYZ',
      appliedDate: '2 weeks ago',
      status: 'applied' as const,
      matchScore: 85,
      emailOpened: false
    },
    {
      id: '4',
      jobTitle: 'React Developer',
      company: 'InnovateInc',
      appliedDate: '3 weeks ago',
      status: 'offered' as const,
      matchScore: 88,
      emailOpened: true,
      notes: 'Offer received! Negotiating salary and start date'
    }
  ]

  return (
    <ThemeProvider>
      <div className="p-6 max-w-4xl mx-auto">
        <ApplicationTracker applications={mockApplications} />
      </div>
    </ThemeProvider>
  )
}