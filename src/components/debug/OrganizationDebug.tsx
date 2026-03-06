
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function OrganizationDebug() {
  const { user } = useAuth()
  const [debugData, setDebugData] = useState<any>(null)
  const [auditData, setAuditData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  const runDebugCheck = async () => {
    if (!user) return
    
    setIsLoading(true)
    try {
      // Get debug user permissions
      const { data: permissionData, error: permissionError } = await supabase
        .rpc('debug_user_permissions')
      
      if (permissionError) {
        console.error('Permission debug error:', permissionError)
      }
      
      // Get platform admin audit
      const { data: auditResult, error: auditError } = await supabase
        .rpc('audit_platform_admin_access')
      
      if (auditError) {
        console.error('Audit error:', auditError)
      }
      
      setDebugData(permissionData?.[0] || null)
      setAuditData(auditResult || [])
    } catch (error) {
      console.error('Debug check failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-xs">Organization Access Debug</h4>
        <Button 
          onClick={runDebugCheck} 
          disabled={isLoading}
          size="sm"
          variant="outline"
          className="text-xs h-6"
        >
          {isLoading ? 'Running...' : 'Run Debug'}
        </Button>
      </div>
      
      {debugData && (
        <div className="space-y-2 text-xs">
          <div><strong>User ID:</strong> {debugData.current_user_id?.slice(0, 8)}...</div>
          <div><strong>User Type:</strong> <Badge variant="outline" className="text-xs h-4">{debugData.user_type}</Badge></div>
          <div><strong>System Role:</strong> <Badge variant="outline" className="text-xs h-4">{debugData.system_role || 'none'}</Badge></div>
          <div><strong>Org ID:</strong> {debugData.organization_id?.slice(0, 8) || 'None'}...</div>
          <div><strong>Member Count:</strong> {debugData.member_count}</div>
          <div><strong>Can See All Orgs:</strong> 
            <Badge variant={debugData.can_see_all_orgs ? "default" : "destructive"} className="text-xs h-4 ml-1">
              {debugData.can_see_all_orgs ? 'YES' : 'NO'}
            </Badge>
          </div>
        </div>
      )}
      
      {auditData && auditData.length > 0 && (
        <div className="mt-4">
          <h5 className="font-medium text-xs mb-2">Platform Admin Audit:</h5>
          <div className="space-y-1 text-xs">
            {auditData.map((admin: any, index: number) => (
              <div key={index} className="border-l-2 border-blue-200 pl-2">
                <div><strong>{admin.user_email}</strong></div>
                <div className="text-muted-foreground">
                  Status: <Badge variant={admin.issue_description === 'OK' ? "default" : "destructive"} className="text-xs h-4">
                    {admin.issue_description}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
