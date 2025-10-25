
import { cn } from '@/lib/utils'
import { LayoutDashboard, Settings, Kanban, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface JobDetailFloatingSidebarProps {
  currentTab: string
  onTabChange: (tab: string) => void
  jobTitle: string
  className?: string
  candidates?: any[]
  onCandidateClick?: (candidateId: string) => void
}

export function JobDetailFloatingSidebar({ 
  currentTab, 
  onTabChange, 
  jobTitle,
  className,
  candidates = [],
  onCandidateClick
}: JobDetailFloatingSidebarProps) {
  const tabs = [
    {
      id: 'candidates',
      label: 'Job Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'pipeline',
      label: 'Pipeline Overview',
      icon: Kanban,
    },
    {
      id: 'job-setup',
      label: 'Job Setup',
      icon: Settings,
    }
  ]

  return (
    <div className={cn("w-64 flex-shrink-0 flex flex-col gap-4", className)}>
      {/* Navigation Pills */}
      <div className="bg-card border border-border rounded-full shadow-lg h-fit py-6 px-3 flex flex-col items-center">
        <nav className="space-y-3">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = currentTab === tab.id
            
            return (
              <Button
                key={tab.id}
                variant="ghost"
                size="icon"
                className={cn(
                  "w-12 h-12 aspect-square !rounded-full p-0 flex items-center justify-center",
                  isActive
                    ? "bg-foreground text-background hover:bg-foreground hover:text-background hover:scale-100 active:scale-100"
                    : "border border-border text-muted-foreground hover:bg-transparent hover:text-inherit hover:scale-100 active:scale-100"
                )}
                onClick={() => onTabChange(tab.id)}
                aria-label={tab.label}
                title={tab.label}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="h-5 w-5" />
                <span className="sr-only">{tab.label}</span>
              </Button>
            )
          })}
        </nav>
      </div>

      {/* Candidates Section */}
      <Card className="flex-1 flex flex-col max-h-[600px]">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Candidates ({candidates.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full">
            <div className="px-4 pb-4">
              {candidates.length === 0 ? (
                <p className="text-sm text-text-secondary text-center py-8">No candidates yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidates.map((candidate) => (
                      <TableRow 
                        key={candidate.id}
                        className="cursor-pointer hover:bg-surface-secondary"
                        onClick={() => onCandidateClick?.(candidate.id)}
                      >
                        <TableCell className="font-medium text-sm">
                          {candidate.candidate_name || 'Unknown'}
                        </TableCell>
                        <TableCell className="text-sm text-text-secondary">
                          {candidate.status || 'Active'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
