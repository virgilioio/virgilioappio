import { useState } from 'react'
import { UserPlus, Search, Link2, Briefcase, ArrowRight, ChevronRight, User, AlertCircle, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

/**
 * Candidate mapping status for a WhatsApp conversation.
 */
export type ConversationMappingStatus =
  | 'linked'           // Conversation is linked to a known candidate
  | 'unlinked'         // Conversation has no candidate link
  | 'multiple_matches' // Multiple possible candidate matches found
  | 'pending_review'   // Awaiting user decision on mapping

export interface ConversationMapping {
  conversationId: string
  candidateId: string | null
  candidateName: string | null
  jobId: string | null
  jobTitle: string | null
  status: ConversationMappingStatus
  phoneNumber: string
  possibleMatches?: Array<{
    id: string
    name: string
    phone: string | null
    email: string | null
    currentTitle: string | null
  }>
}

interface WhatsAppConversationMappingPanelProps {
  mapping: ConversationMapping
  onLinkCandidate?: (candidateId: string) => void
  onCreateCandidate?: () => void
  onLinkJob?: (jobId: string) => void
  onUnlink?: () => void
  className?: string
}

/**
 * Panel that shows the mapping status of a WhatsApp conversation
 * and provides actions to link, create, or manage candidate associations.
 */
export function WhatsAppConversationMappingPanel({
  mapping,
  onLinkCandidate,
  onCreateCandidate,
  onLinkJob,
  onUnlink,
  className,
}: WhatsAppConversationMappingPanelProps) {
  const [showLinkSheet, setShowLinkSheet] = useState(false)

  return (
    <>
      <div className={cn('space-y-3', className)}>
        {/* Status indicator */}
        <div className={cn(
          'p-3 rounded-lg border flex items-start gap-3',
          mapping.status === 'linked'
            ? 'bg-[#25D366]/5 border-[#25D366]/20'
            : mapping.status === 'multiple_matches'
            ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/30'
            : 'bg-muted/30 border-border'
        )}>
          {mapping.status === 'linked' ? (
            <>
              <Check className="h-4 w-4 text-[#25D366] shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium text-foreground truncate">
                    {mapping.candidateName}
                  </p>
                  <Badge variant="outline" className="text-[9px] border-[#25D366]/30 text-[#25D366] shrink-0">
                    Linked
                  </Badge>
                </div>
                {mapping.jobTitle && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Briefcase className="h-2.5 w-2.5" />
                    {mapping.jobTitle}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                  {mapping.phoneNumber}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] text-muted-foreground shrink-0"
                onClick={onUnlink}
              >
                Unlink
              </Button>
            </>
          ) : mapping.status === 'multiple_matches' ? (
            <>
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground">Multiple matches found</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {mapping.possibleMatches?.length || 0} candidates match this phone number. Review and select the correct one.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs shrink-0"
                onClick={() => setShowLinkSheet(true)}
              >
                Review
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </>
          ) : (
            <>
              <User className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground">Not linked to a candidate</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                  {mapping.phoneNumber}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Actions for unlinked conversations */}
        {(mapping.status === 'unlinked' || mapping.status === 'pending_review') && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setShowLinkSheet(true)}
            >
              <Link2 className="h-3 w-3 mr-1.5" />
              Link to candidate
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={onCreateCandidate}
            >
              <UserPlus className="h-3 w-3 mr-1.5" />
              Create candidate
            </Button>
          </div>
        )}

        {/* Link to job action (for linked but no job) */}
        {mapping.status === 'linked' && !mapping.jobId && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground w-full justify-start"
            onClick={() => onLinkJob?.('')}
          >
            <Briefcase className="h-3 w-3 mr-1.5" />
            Associate with a job
          </Button>
        )}
      </div>

      {/* Link candidate sheet */}
      <WhatsAppLinkCandidateSheet
        open={showLinkSheet}
        onOpenChange={setShowLinkSheet}
        phoneNumber={mapping.phoneNumber}
        possibleMatches={mapping.possibleMatches}
        onLink={(candidateId) => {
          onLinkCandidate?.(candidateId)
          setShowLinkSheet(false)
        }}
        onCreate={() => {
          onCreateCandidate?.()
          setShowLinkSheet(false)
        }}
      />
    </>
  )
}

interface WhatsAppLinkCandidateSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  phoneNumber: string
  possibleMatches?: ConversationMapping['possibleMatches']
  onLink: (candidateId: string) => void
  onCreate: () => void
}

function WhatsAppLinkCandidateSheet({
  open,
  onOpenChange,
  phoneNumber,
  possibleMatches,
  onLink,
  onCreate,
}: WhatsAppLinkCandidateSheetProps) {
  const [search, setSearch] = useState('')

  const filteredMatches = (possibleMatches || []).filter((m) =>
    !search || m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-base">Link conversation to candidate</SheetTitle>
          <SheetDescription className="text-xs">
            Associate this WhatsApp conversation ({phoneNumber}) with a candidate in your pipeline.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search candidates…"
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* Possible matches */}
          {filteredMatches.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
                Possible matches
              </p>
              <ScrollArea className="max-h-60">
                <div className="space-y-1">
                  {filteredMatches.map((match) => (
                    <button
                      key={match.id}
                      onClick={() => onLink(match.id)}
                      className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors flex items-center gap-3"
                    >
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0">
                        {match.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{match.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {match.currentTitle && (
                            <span className="text-[10px] text-muted-foreground truncate">{match.currentTitle}</span>
                          )}
                          {match.phone && (
                            <span className="text-[10px] text-muted-foreground font-mono">{match.phone}</span>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* No matches state */}
          {filteredMatches.length === 0 && search && (
            <div className="py-8 text-center">
              <Search className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No candidates match "{search}"</p>
            </div>
          )}

          {/* Create new */}
          <div className="pt-2 border-t border-border">
            <Button
              variant="outline"
              onClick={onCreate}
              className="w-full justify-start text-sm"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Create new candidate from this conversation
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
