import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, MessageSquare, FileText, Settings, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  useWhatsAppConversation,
  useWhatsAppMessages,
  useSendWhatsAppMessage,
  useMarkWhatsAppRead,
} from '@/hooks/useWhatsApp'
import { useWhatsAppTemplates, useWhatsAppSetupStatus, type WhatsAppTemplate } from '@/hooks/useWhatsAppConfig'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import whatsappBg from '@/assets/whatsapp-chat-bg.png'
import { useNavigate } from 'react-router-dom'
import { useTenant } from '@/hooks/useTenant'
import { useAuth } from '@/contexts/AuthContext'

interface WhatsAppChatTabProps {
  candidateId: string
  jobId?: string
  phoneNumber?: string
  candidateName: string
  companyName?: string
  jobTitle?: string
  recruiterName?: string
}

export function WhatsAppChatTab({
  candidateId,
  jobId,
  phoneNumber,
  candidateName,
  companyName: companyNameProp,
  jobTitle: jobTitleProp,
  recruiterName: recruiterNameProp,
}: WhatsAppChatTabProps) {
  const [message, setMessage] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { data: conversation } = useWhatsAppConversation(candidateId, jobId)
  const { data: messages = [], isLoading } = useWhatsAppMessages(conversation?.id)
  const sendMessage = useSendWhatsAppMessage()
  const markRead = useMarkWhatsAppRead()
  const { data: templates = [] } = useWhatsAppTemplates()
  const setupState = useWhatsAppSetupStatus()

  // Fallback data fetching for template variables
  const { tenant } = useTenant()
  const { user } = useAuth()

  const companyName = companyNameProp || tenant?.name
  const jobTitle = jobTitleProp
  const recruiterName = recruiterNameProp || user?.user_metadata?.full_name || user?.email

  const targetPhone = phoneNumber || conversation?.phone_number

  // Determine if we're in a 24h session (has recent inbound message)
  const lastInbound = messages.filter((m) => m.direction === 'inbound').pop()
  const hasActiveSession =
    lastInbound &&
    Date.now() - new Date(lastInbound.created_at).getTime() < 24 * 60 * 60 * 1000

  const isFirstContact = messages.length === 0
  const needsTemplate = isFirstContact || !hasActiveSession

  const hasOutboundMessages = messages.some((m) => m.direction === 'outbound')
  const awaitingReply = hasOutboundMessages && !hasActiveSession

  // Mark as read when conversation opens
  useEffect(() => {
    if (conversation?.id && conversation.unread_count > 0) {
      markRead.mutate(conversation.id)
    }
  }, [conversation?.id, conversation?.unread_count])

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const resolveTemplateVariables = (template: WhatsAppTemplate) => {
    const mapping = template.variable_mapping || {}
    const variables: Record<string, string> = {}
    Object.entries(mapping).forEach(([key, field]) => {
      switch (field) {
        case 'candidate.name':
          variables[key] = candidateName || ''; break
        case 'candidate.first_name':
          variables[key] = candidateName?.split(' ')[0] || ''; break
        case 'candidate.email':
          variables[key] = ''; break
        case 'candidate.phone':
          variables[key] = phoneNumber || ''; break
        case 'job.title':
          variables[key] = jobTitle || 'the position'; break
        case 'job.department': case 'job.location':
          variables[key] = ''; break
        case 'company.name': case 'organization.name':
          variables[key] = companyName || 'our company'; break
        case 'recruiter.name': case 'sender.name':
          variables[key] = recruiterName || 'Our team'; break
        case 'sender.first_name':
          variables[key] = recruiterName?.split(' ')[0] || ''; break
        case 'sender.email':
          variables[key] = user?.email || ''; break
        case 'interview.date':
          variables[key] = '[Date TBD]'; break
        case 'interview.time':
          variables[key] = '[Time TBD]'; break
        default:
          variables[key] = ''; break
      }
    })
    return variables
  }

  const getPreviewText = (template: WhatsAppTemplate) => {
    const vars = resolveTemplateVariables(template)
    let text = template.body_template
    Object.entries(vars).forEach(([key, value]) => {
      text = text.replace(`{{${key}}}`, value)
    })
    return text
  }

  const handleSend = async () => {
    if (!targetPhone) return

    try {
      if (selectedTemplate) {
        const variables = resolveTemplateVariables(selectedTemplate)
        await sendMessage.mutateAsync({
          to: targetPhone,
          body: getPreviewText(selectedTemplate),
          candidate_id: candidateId,
          job_id: jobId,
          template_id: selectedTemplate.id,
          template_variables: variables,
        })
        setSelectedTemplate(null)
        setShowTemplates(false)
      } else if (message.trim()) {
        await sendMessage.mutateAsync({
          to: targetPhone,
          body: message.trim(),
          candidate_id: candidateId,
          job_id: jobId,
        })
        setMessage('')
      }
      toast({ title: 'Message sent' })
    } catch (error: any) {
      toast({ title: 'Failed to send', description: error?.message || 'Unknown error', variant: 'destructive' })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Not set up at all
  if (!setupState.isLoading && setupState.status === 'not_started') {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 text-center px-4">
        <MessageSquare className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-foreground">WhatsApp not set up</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
          Set up workspace WhatsApp in Settings to start messaging candidates.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => navigate('/settings?tab=integrations')}
        >
          <Settings className="h-3.5 w-3.5 mr-1.5" />
          Set up WhatsApp
        </Button>
      </div>
    )
  }

  if (!targetPhone) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 text-center px-4">
        <MessageSquare className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-foreground">No phone number</p>
        <p className="text-xs text-muted-foreground mt-1">
          Add a phone number to this candidate to start a WhatsApp conversation.
        </p>
      </div>
    )
  }

  // All templates available for selection (approved ones with SID preferred, but allow all)
  const usableTemplates = templates.filter(
    (t) => !!t.twilio_content_sid && t.approval_status === 'approved'
  )

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="px-4 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[#25D366]" />
          <span className="text-xs text-muted-foreground">
            WhatsApp · {targetPhone}
          </span>
        </div>
        {needsTemplate && (
          <Badge variant="outline" className="text-[10px] border-yellow-500/30 text-yellow-600">
            Template required
          </Badge>
        )}
        {hasActiveSession && (
          <Badge variant="outline" className="text-[10px] border-[#25D366]/30 text-[#25D366]">
            Session active
          </Badge>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 relative" ref={scrollRef}>
        <div
          className="absolute inset-0 bg-cover bg-center pointer-events-none"
          style={{ backgroundImage: `url(${whatsappBg})` }}
        />
        <div className="relative px-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="h-6 w-6 text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">
              No messages yet. Select a template to start the conversation with {candidateName}.
            </p>
          </div>
        ) : (
          <div className="space-y-3 py-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'max-w-[80%] rounded-lg px-3 py-2',
                  msg.direction === 'outbound'
                    ? 'ml-auto bg-[#dcf8c6] text-foreground'
                    : 'mr-auto bg-white text-foreground shadow-sm'
                )}
              >
                <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                  </span>
                  {msg.direction === 'outbound' && (
                    <span className={cn(
                      "text-[10px] capitalize",
                      msg.status === 'failed' || msg.status === 'undelivered'
                        ? 'text-destructive font-medium'
                        : 'text-muted-foreground'
                    )}>
                      · {msg.status === 'failed' || msg.status === 'undelivered' ? '⚠ ' + msg.status : msg.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </ScrollArea>

      {/* Compose area */}
      {awaitingReply ? (
        <div className="border-t border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800/40 p-4">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                Waiting for reply
              </p>
              <p className="text-xs text-amber-700/80 dark:text-amber-400/70 mt-1">
                You've already sent a template message. Per WhatsApp policy, you cannot send another message until {candidateName.split(' ')[0]} responds (opens a 24-hour session).
              </p>
            </div>
          </div>
        </div>
      ) : (
      <div className="border-t border-border p-3 space-y-2">
        {/* Template list when expanded */}
        {needsTemplate && !selectedTemplate && showTemplates && (
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {usableTemplates.length > 0 ? (
              usableTemplates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedTemplate(t)
                    setShowTemplates(false)
                  }}
                  className="w-full text-left p-2.5 rounded-md border border-border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium">{t.name}</p>
                    {!t.tenant_id && (
                      <Badge variant="secondary" className="text-[9px]">GoGio</Badge>
                    )}
                    <Badge variant="outline" className="text-[9px] border-[#25D366]/30 text-[#25D366]">
                      Approved
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                    {getPreviewText(t)}
                  </p>
                </button>
              ))
            ) : (
              <div className="p-4 text-center">
                <FileText className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  No approved templates available yet.
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Templates are being set up by the GoGio team. You can send freeform messages once a candidate replies.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Selected template preview */}
        {selectedTemplate && (
          <div className="p-2.5 rounded-md bg-[#25D366]/5 border border-[#25D366]/20">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium">{selectedTemplate.name}</p>
              <button
                onClick={() => setSelectedTemplate(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Change
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{getPreviewText(selectedTemplate)}</p>
          </div>
        )}

        {/* Input row — always a single line with send button */}
        <div className="flex items-center gap-2">
          {needsTemplate ? (
            <>
              {!selectedTemplate && !showTemplates && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTemplates(true)}
                  className="flex-1 justify-start text-xs"
                >
                  <FileText className="h-3.5 w-3.5 mr-2" />
                  Select a template to start conversation
                </Button>
              )}
              <button
                onClick={handleSend}
                disabled={!selectedTemplate || sendMessage.isPending}
                className="shrink-0 h-10 w-10 rounded-full bg-virgilio-purple hover:bg-virgilio-purple/90 text-white inline-flex items-center justify-center disabled:opacity-50 disabled:pointer-events-none transition-colors ml-auto"
              >
                {sendMessage.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </>
          ) : (
            <>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${candidateName}...`}
                className="min-h-[40px] max-h-[120px] resize-none text-sm flex-1"
                rows={1}
              />
              <button
                onClick={handleSend}
                disabled={!message.trim() || sendMessage.isPending}
                className="shrink-0 h-10 w-10 rounded-full bg-virgilio-purple hover:bg-virgilio-purple/90 text-white inline-flex items-center justify-center disabled:opacity-50 disabled:pointer-events-none transition-colors"
              >
                {sendMessage.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </>
          )}
        </div>
      </div>
      )}
    </div>
  )
}
