import { JobCard } from '../JobCard'
import { ThemeProvider } from '../ThemeProvider'

export default function JobCardExample() {
  // todo: remove mock functionality
  const mockJobs = [
    {
      id: '1',
      title: 'Senior Frontend Developer',
      company: 'TechCorp Solutions',
      location: 'Bangalore, India',
      type: 'Full-time',
      salary: '₹15-25 LPA',
      postedDate: '2 days ago',
      matchScore: 92,
      description: 'We are looking for an experienced Frontend Developer to join our dynamic team. You will be responsible for developing user-facing web applications using modern JavaScript frameworks.',
      requirements: ['React', 'TypeScript', 'Tailwind CSS', 'Node.js', '5+ years experience']
    },
    {
      id: '2',
      title: 'Product Designer',
      company: 'Design Studio',
      location: 'Mumbai, India',
      type: 'Contract',
      postedDate: '1 week ago',
      matchScore: 78,
      description: 'Join our creative team to design intuitive user experiences for mobile and web applications. Work with cross-functional teams to deliver exceptional product designs.',
      requirements: ['Figma', 'UI/UX Design', 'Prototyping', 'User Research']
    }
  ]

  return (
    <ThemeProvider>
      <div className="grid gap-6 md:grid-cols-2 p-6">
        {mockJobs.map((job) => (
          <JobCard key={job.id} jobMatch={{
            job,
            matchScore: job.matchScore,
            explanation: `${job.matchScore}% match based on your profile`,
            skillsMatch: {
              matched: job.requirements?.slice(0, 3) || [],
              missing: [],
              score: job.matchScore
            },
            experienceMatch: {
              suitable: job.matchScore >= 75,
              explanation: 'Experience level appears suitable',
              score: job.matchScore
            },
            locationMatch: {
              suitable: true,
              explanation: 'Location matches your preferences',
              score: 85
            },
            salaryMatch: {
              suitable: true,
              explanation: 'Salary range within expectations',
              score: 80
            }
          }} />
        ))}
      </div>
    </ThemeProvider>
  )
}