import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Briefcase, User, Bell } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface HeaderProps {
  user?: {
    name: string
    email: string
    plan: 'Explorer' | 'Applicant' | 'Strategist'
  }
}

export function Header({ user }: HeaderProps) {
  const handleLogin = () => {
    console.log('Login clicked')
  }

  const handleSignup = () => {
    console.log('Sign up clicked')
  }

  const handleProfileClick = () => {
    console.log('Profile clicked')
  }

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold text-foreground">Career Co-Pilot</span>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </a>
            <a href="#about" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              About
            </a>
          </nav>

          {/* User Actions */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Button variant="ghost" size="icon" data-testid="button-notifications">
                  <Bell className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" data-testid="badge-user-plan">{user.plan}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleProfileClick}
                    className="flex items-center gap-2"
                    data-testid="button-profile"
                  >
                    <User className="h-4 w-4" />
                    <span className="hidden sm:inline">{user.name}</span>
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogin}
                  data-testid="button-login"
                >
                  Login
                </Button>
                <Button
                  size="sm"
                  onClick={handleSignup}
                  data-testid="button-signup"
                >
                  Sign Up
                </Button>
              </>
            )}
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  )
}