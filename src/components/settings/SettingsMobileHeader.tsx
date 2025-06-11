
import { Menu, ArrowLeft, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'

interface SettingsMobileHeaderProps {
  onMenuToggle: () => void
  onBackToDashboard: () => void
}

export function SettingsMobileHeader({ onMenuToggle, onBackToDashboard }: SettingsMobileHeaderProps) {
  const { logout } = useAuth()

  const handleLogout = async () => {
    try {
      await logout()
      toast({
        title: 'Logged out',
        description: 'You have been successfully logged out.'
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to log out. Please try again.',
        variant: 'destructive'
      })
    }
  }

  return (
    <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur md:hidden">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuToggle}
          className="h-9 w-9"
        >
          <Menu className="h-4 w-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onBackToDashboard}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>
      
      <Button 
        variant="destructive" 
        size="sm"
        onClick={handleLogout}
        className="flex items-center gap-2"
      >
        <LogOut className="h-4 w-4" />
        Logout
      </Button>
    </div>
  )
}
