import { Header } from '../Header'
import { ThemeProvider } from '../ThemeProvider'

export default function HeaderExample() {
  // Mock user data for logged in state
  const mockUser = {
    name: 'Sarah Johnson',
    email: 'sarah@example.com',
    plan: 'Applicant' as const
  }

  return (
    <ThemeProvider>
      <div className="space-y-4">
        {/* Logged out state */}
        <Header />
        
        {/* Logged in state */}
        <Header user={mockUser} />
      </div>
    </ThemeProvider>
  )
}