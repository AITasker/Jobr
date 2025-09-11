import { Header } from '../Header'
import { ThemeProvider } from '../ThemeProvider'

export default function HeaderExample() {
  return (
    <ThemeProvider>
      <div className="space-y-4">
        {/* Logged out state */}
        <Header />
        
        {/* Logged in state - uses real auth */}
        <Header />
      </div>
    </ThemeProvider>
  )
}