import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useAuth } from '@/hooks/useAuth'
import { Briefcase, User, Bell } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface HeaderProps {
  showAuth?: boolean
}

export function Header({ showAuth = true }: HeaderProps) {
  const { user, isAuthenticated } = useAuth()
  
  // Type guard for user object
  const typedUser = user as {
    plan?: string
    firstName?: string
    lastName?: string
    email?: string
  } | undefined
  
  const handleLogin = () => {
    window.location.href = '/api/login'
  }

  const handleLogout = () => {
    window.location.href = '/api/logout'
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
            {showAuth && (
              <>
                {isAuthenticated && user ? (
                  <>
                    <Button variant="ghost" size="icon" data-testid="button-notifications">
                      <Bell className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" data-testid="badge-user-plan">{typedUser?.plan || 'Explorer'}</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleProfileClick}
                        className="flex items-center gap-2"
                        data-testid="button-profile"
                      >
                        <User className="h-4 w-4" />
                        <span className="hidden sm:inline">
                          {typedUser?.firstName || typedUser?.email?.split('@')[0] || 'User'}
                        </span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleLogout}
                        data-testid="button-logout"
                      >
                        Logout
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
                      onClick={handleLogin}
                      data-testid="button-signup"
                    >
                      Get Started
                    </Button>
                  </>
                )}
              </>
            )}
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  )
}