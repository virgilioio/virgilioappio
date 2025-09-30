import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown, ChevronRight, Download, Trash2 } from 'lucide-react'
import { useSessionDebugger } from '@/hooks/useSessionDebugger'

export function SessionDebugPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const { getDebugReport, clearDebugLog } = useSessionDebugger()

  const handleDownloadReport = () => {
    const report = getDebugReport()
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `session-debug-report-${new Date().toISOString()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const report = getDebugReport()
  const criticalEvents = report.logs.filter(log => 
    ['session_lost', 'auth_token_cleared', 'auth_error', 'network_error'].includes(log.event)
  )

  return (
    <Card className="fixed bottom-4 right-4 w-96 z-50 shadow-lg">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 p-3">
            <CardTitle className="flex items-center justify-between text-sm">
              <span>Session Debug</span>
              <div className="flex items-center gap-2">
                {criticalEvents.length > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {criticalEvents.length} issues
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  {report.summary.totalEvents} events
                </Badge>
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </div>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="p-3 pt-0">
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleDownloadReport}
                  className="flex-1"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Export
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={clearDebugLog}
                  className="flex-1"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              </div>

              {criticalEvents.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-destructive">Critical Issues</h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {criticalEvents.slice(-5).map((log, idx) => (
                      <div key={idx} className="text-xs p-2 bg-destructive/10 rounded border-l-2 border-destructive">
                        <div className="font-medium">{log.event}</div>
                        <div className="text-muted-foreground">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </div>
                        {log.details && Object.keys(log.details).length > 0 && (
                          <pre className="mt-1 text-xs bg-background/50 p-1 rounded">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Recent Events</h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {report.logs.slice(-10).map((log, idx) => (
                    <div key={idx} className="text-xs p-2 bg-muted/20 rounded">
                      <div className="flex justify-between items-start">
                        <span className="font-medium">{log.event}</span>
                        <span className="text-muted-foreground">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      {log.sessionState && (
                        <div className="text-muted-foreground">
                          Session: {log.sessionState.hasSession ? '✅' : '❌'} 
                          {log.sessionState.userId && ` (${log.sessionState.userId.slice(0, 8)}...)`}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}