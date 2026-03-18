
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SettingsMobileHeaderProps {
  onMenuToggle: () => void
  onBackToDashboard: () => void
}

export function SettingsMobileHeader({ onMenuToggle }: SettingsMobileHeaderProps) {
  return (
    <div className="flex items-center gap-3 p-4 border-b border-virgilio-border bg-background/95 backdrop-blur lg:hidden">
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuToggle}
        className="h-9 w-9"
      >
        <Menu className="h-4 w-4" />
      </Button>
      <h1 className="text-lg font-semibold text-virgilio-text">
        Settings<span className="text-virgilio-purple">.</span>
      </h1>
    </div>
  )
}
