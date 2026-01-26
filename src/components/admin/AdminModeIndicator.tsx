
import { Badge } from "@/components/ui/badge"
import { Shield } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"

export function AdminModeIndicator() {
  const { userType } = useAuth()
  
  const isPlatformAdmin = userType === 'platform_admin'
  
  if (!isPlatformAdmin) {
    return null
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mb-4 p-3 bg-virgilio-purple/10 border border-virgilio-purple/30 rounded-lg">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-virgilio-purple" />
        <Badge variant="outline" className="bg-virgilio-purple/20 text-virgilio-purple border-virgilio-purple/40">
          Platform Admin
        </Badge>
      </div>
      <span className="text-sm text-virgilio-purple sm:ml-1">
        <span className="hidden sm:inline">You're viewing data across all organizations</span>
        <span className="sm:hidden">Viewing all organizations</span>
      </span>
    </div>
  )
}
