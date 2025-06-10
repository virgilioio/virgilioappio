
import { Badge } from "@/components/ui/badge"
import { Shield, Building2 } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"

export function AdminModeIndicator() {
  const { userType } = useAuth()
  
  const isPlatformAdmin = userType === 'platform_admin'
  
  if (!isPlatformAdmin) {
    return null
  }

  return (
    <div className="flex items-center gap-2 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
      <Shield className="h-4 w-4 text-amber-600" />
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
          Platform Admin Mode
        </Badge>
        <span className="text-sm text-amber-700">
          You're viewing data across all organizations
        </span>
      </div>
    </div>
  )
}
