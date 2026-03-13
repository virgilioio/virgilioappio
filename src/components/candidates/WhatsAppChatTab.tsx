import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, MessageSquare, FileText, Settings } from 'lucide-react'
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
import { useNavigate } from 'react-router-dom'

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
  companyName,
  jobTitle,
  recruiterName,
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

  const targetPhone = phoneNumber || conversation?.phone_number

  // Determine if we're in a 24h session (has recent inbound message)
  const lastInbound = messages.filter((m) => m.direction === 'inbound').pop()
  const hasActiveSession =
    lastInbound &&
    Date.now() - new Date(lastInbound.created_at).getTime() < 24 * 60 * 60 * 1000

  const isFirstContact = messages.length === 0
  const needsTemplate = isFirstContact || !hasActiveSession

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
        case 'candidate_name':
          variables[key] = candidateName
          break
        case 'recruiter_name':
          variables[key] = recruiterName || 'Our team'
          break
        case 'company_name':
          variables[key] = companyName || 'our company'
          break
        case 'job_title':
          variables[key] = jobTitle || 'the position'
          break
        case 'interview_date':
          variables[key] = '[Date TBD]'
          break
        default:
          variables[key] = `[${field}]`
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
    } catch (error) {
      // Error handled by mutation
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
      <ScrollArea className="flex-1 px-4" ref={scrollRef}>
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
                    ? 'ml-auto bg-[#25D366]/10 text-foreground'
                    : 'mr-auto bg-muted text-foreground'
                )}
              >
                <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                  </span>
                  {msg.direction === 'outbound' && (
                    <span className="text-[10px] text-muted-foreground capitalize">
                      · {msg.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Compose area */}
      <div className="border-t border-border p-3 space-y-2">
        {/* Template selector for first contact */}
        {needsTemplate && !selectedTemplate && (
          <div className="space-y-2">
            {showTemplates ? (
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
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTemplates(true)}
                className="w-full justify-start text-xs"
              >
                <FileText className="h-3.5 w-3.5 mr-2" />
                Select a template to start conversation
              </Button>
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

        {/* Freeform input or send button */}
        <div className="flex gap-2">
          {needsTemplate ? (
            <Button
              className="w-full bg-[#25D366] hover:bg-[#25D366]/90 text-white"
              onClick={handleSend}
              disabled={!selectedTemplate || sendMessage.isPending}
            >
              {sendMessage.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Template
            </Button>
          ) : (
            <>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${candidateName}...`}
                className="min-h-[40px] max-h-[120px] resize-none text-sm"
                rows={1}
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!message.trim() || sendMessage.isPending}
                className="shrink-0 bg-[#25D366] hover:bg-[#25D366]/90 text-white"
              >
                {sendMessage.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
