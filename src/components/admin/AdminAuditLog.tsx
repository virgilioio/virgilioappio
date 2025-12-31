import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { format } from 'date-fns'
import { log } from '@/lib/logger'
import { Loader2, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { TableSkeleton } from '@/components/ui/skeleton'

interface AuditLogEntry {
  id: string
  user_id: string
  action: string
  table_name: string
  record_id: string
  old_values: any
  new_values: any
  ip_address: unknown // inet type from PostgreSQL
  user_agent: string
  created_at: string
}

export function AdminAuditLog() {
  const { userType } = useAuth()
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [tableFilter, setTableFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (userType !== 'platform_admin') {
      setError('Only platform administrators can view audit logs')
      setIsLoading(false)
      return
    }
    
    fetchAuditLogs()
  }, [userType])

  const fetchAuditLogs = async () => {
    setIsLoading(true)
    setError(null)

    try {
      log.debug('Fetching audit logs')
      
      // Use RPC function to query audit logs from the audit schema
      const { data, error: fetchError } = await supabase
        .rpc('get_audit_logs', { 
          p_limit: 100,
          p_offset: 0 
        })

      if (fetchError) {
        log.error('Error fetching audit logs:', fetchError)
        throw fetchError
      }

      log.debug('Fetched audit logs:', data?.length)
      setLogs(data || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch audit logs'
      log.error('Error in fetchAuditLogs:', err)
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const getActionBadgeVariant = (action: string) => {
    if (action.includes('delete')) return 'destructive'
    if (action.includes('create') || action.includes('insert')) return 'default'
    if (action.includes('update') || action.includes('manage')) return 'secondary'
    return 'outline'
  }

  const filteredLogs = logs.filter(log => {
    if (actionFilter !== 'all' && !log.action.includes(actionFilter)) return false
    if (tableFilter !== 'all' && log.table_name !== tableFilter) return false
    if (searchTerm && !log.action.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !log.table_name?.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !log.record_id?.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false
    }
    return true
  })

  const uniqueActions = Array.from(new Set(logs.map(l => l.action.split('_')[0] || l.action)))
  const uniqueTables = Array.from(new Set(logs.map(l => l.table_name).filter(Boolean)))

  if (userType !== 'platform_admin') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Audit Log</CardTitle>
          <CardDescription>Access Denied</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Only platform administrators can view the audit log.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin Audit Log</CardTitle>
        <CardDescription>
          View all privileged operations performed by platform administrators
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search by action, table, or record ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {uniqueActions.map(action => (
                <SelectItem key={action} value={action}>
                  {action}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={tableFilter} onValueChange={setTableFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by table" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tables</SelectItem>
              {uniqueTables.map(table => (
                <SelectItem key={table} value={table || ''}>
                  {table}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Loading/Error States */}
        {isLoading && (
          <TableSkeleton rows={8} />
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Audit Log Table */}
        {!isLoading && !error && (
          <ScrollArea className="h-[600px] rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>Record ID</TableHead>
                  <TableHead>User ID</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No audit logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono text-xs">
                        {format(new Date(entry.created_at), 'yyyy-MM-dd HH:mm:ss')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getActionBadgeVariant(entry.action)}>
                          {entry.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {entry.table_name || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {entry.record_id?.substring(0, 8)}...
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {entry.user_id?.substring(0, 8)}...
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {entry.ip_address ? String(entry.ip_address) : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        )}

        <div className="text-sm text-muted-foreground">
          Showing {filteredLogs.length} of {logs.length} audit log entries
        </div>
      </CardContent>
    </Card>
  )
}
