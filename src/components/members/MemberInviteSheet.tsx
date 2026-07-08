import { useState, useEffect, useMemo, useRef, useCallback, KeyboardEvent, ClipboardEvent } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { usePermissions } from "@/hooks/usePermissions"
import { useOrganizations } from "@/hooks/useOrganizations"
import { useSeatsLimit } from "@/hooks/useSeatsLimit"
import { useBillingStatus } from "@/hooks/useBillingStatus"
import { useToast } from "@/hooks/use-toast"
import { Member } from "@/hooks/useMembers"
import {
  X,
  UserPlus,
  Mail,
  AlertCircle,
  AlertTriangle,
  Info,
  Ticket,
  Send,
  ShieldCheck,
  Users,
  Handshake,
  Check,
  Plus,
} from "lucide-react"
import { SeatLimitUpgradeDialog } from "./SeatLimitUpgradeDialog"

interface MemberInviteSheetProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: any) => Promise<any>
  member?: Member | null
  isLoading: boolean
}

type RoleValue = "admin" | "member" | "sales"

interface RoleDef {
  value: RoleValue
  label: string
  description: string
  icon: typeof ShieldCheck
  seat: "paid" | "free"
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PERSONAL_DOMAINS = new Set([
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "yahoo.com",
  "icloud.com",
])

function isValidEmail(v: string) {
  return EMAIL_RE.test(v.trim())
}

function isPersonalEmail(v: string) {
  const domain = v.trim().toLowerCase().split("@")[1]
  return !!domain && PERSONAL_DOMAINS.has(domain)
}

interface EmailChip {
  value: string
  valid: boolean
}

export function MemberInviteSheet({
  isOpen,
  onClose,
  onSubmit,
  member,
  isLoading,
}: MemberInviteSheetProps) {
  const isEditing = !!member

  const { organizationId } = useAuth()
  const { organizations } = useOrganizations()
  const permissions = usePermissions()
  const { toast } = useToast()
  const { data: billing } = useBillingStatus()

  const currentOrg = organizations.find((o) => o.id === organizationId)
  const orgName = currentOrg?.name || "your workspace"
  const tenantId = currentOrg?.tenant_id
  const { data: seatInfo } = useSeatsLimit(tenantId)

  const seatsLeft = useMemo(() => {
    if (!seatInfo) return null
    if (seatInfo.seat_limit == null) return Infinity
    return Math.max(0, seatInfo.seat_limit - seatInfo.current_seats)
  }, [seatInfo])

  const roleOptions: RoleDef[] = useMemo(() => {
    const roles: RoleDef[] = []
    if (permissions.isPlatformAdmin || permissions.isWorkspaceOwner) {
      roles.push({
        value: "admin",
        label: "Admin",
        description:
          "Full organization management access — settings, members, and billing.",
        icon: ShieldCheck,
        seat: "paid",
      })
    }
    roles.push({
      value: "member",
      label: "Member",
      description:
        "Assignable to jobs as recruiter, hiring manager, or interviewer.",
      icon: Users,
      seat: "free",
    })
    roles.push({
      value: "sales",
      label: "Sales",
      description:
        "CRM only — manages companies and deals. No access to recruiting.",
      icon: Handshake,
      seat: "paid",
    })
    return roles
  }, [permissions.isPlatformAdmin, permissions.isWorkspaceOwner])

  const [chips, setChips] = useState<EmailChip[]>([])
  const [draft, setDraft] = useState("")
  const [role, setRole] = useState<RoleValue>("member")
  const [messageOpen, setMessageOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)
  const [seatLimitInfo, setSeatLimitInfo] = useState<{
    currentSeats: number
    seatLimit: number | null
    isTrial: boolean
  } | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const chipContainerRef = useRef<HTMLDivElement>(null)

  // Reset when opening / when editing target changes
  useEffect(() => {
    if (!isOpen) return
    if (isEditing && member) {
      setChips([
        {
          value: member.user_email || member.invited_email || "",
          valid: true,
        },
      ])
      setDraft("")
      setRole(((member.system_role as RoleValue) || "member"))
      setMessageOpen(false)
      setMessage("")
    } else {
      setChips([])
      setDraft("")
      setRole("member")
      setMessageOpen(false)
      setMessage("")
    }
    // focus input soon after open
    const t = setTimeout(() => inputRef.current?.focus(), 40)
    return () => clearTimeout(t)
  }, [isOpen, isEditing, member])

  const commitTokens = useCallback(
    (raw: string) => {
      const parts = raw
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter(Boolean)
      if (parts.length === 0) return
      setChips((prev) => {
        const seen = new Set(prev.map((c) => c.value.toLowerCase()))
        const next = [...prev]
        for (const p of parts) {
          const key = p.toLowerCase()
          if (seen.has(key)) continue
          seen.add(key)
          next.push({ value: p, valid: isValidEmail(p) })
        }
        return next
      })
    },
    [],
  )

  const removeChip = (idx: number) => {
    setChips((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (
      e.key === "Enter" ||
      e.key === "," ||
      e.key === ";" ||
      e.key === " " ||
      e.key === "Tab"
    ) {
      if (draft.trim()) {
        e.preventDefault()
        commitTokens(draft)
        setDraft("")
      } else if (e.key === "Enter") {
        e.preventDefault()
        void handleConfirm()
      }
    } else if (e.key === "Backspace" && !draft && chips.length > 0) {
      e.preventDefault()
      setChips((prev) => prev.slice(0, -1))
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text")
    if (text && /[\s,;]/.test(text)) {
      e.preventDefault()
      commitTokens(text)
      setDraft("")
    }
  }

  const handleBlur = () => {
    if (draft.trim()) {
      commitTokens(draft)
      setDraft("")
    }
  }

  const validChips = chips.filter((c) => c.valid)
  const invalidChips = chips.filter((c) => !c.valid)
  const hasPersonal = validChips.some((c) => isPersonalEmail(c.value))

  const selectedRoleDef = roleOptions.find((r) => r.value === role)
  const rolePaid = selectedRoleDef?.seat === "paid"
  const overSeats =
    rolePaid &&
    seatsLeft !== null &&
    seatsLeft !== Infinity &&
    validChips.length > (seatsLeft as number)

  const canConfirm =
    !submitting &&
    !isLoading &&
    !!selectedRoleDef &&
    (isEditing ? true : validChips.length >= 1 && invalidChips.length === 0)

  const handleConfirm = async () => {
    // commit any half-typed text first
    if (draft.trim()) {
      commitTokens(draft)
      setDraft("")
    }
    if (isEditing) {
      try {
        setSubmitting(true)
        await onSubmit({ system_role: role })
        onClose()
      } catch (err) {
        console.error(err)
        toast({
          title: "Error",
          description: "Failed to update member.",
          variant: "destructive",
        })
      } finally {
        setSubmitting(false)
      }
      return
    }

    const emails = chips.filter((c) => c.valid).map((c) => c.value)
    if (emails.length === 0 || !selectedRoleDef) return

    setSubmitting(true)
    let failures = 0
    let seatLimitHit = false

    for (const email of emails) {
      try {
        await onSubmit({
          email,
          system_role: role,
          user_type: "member",
          organization_id: organizationId,
          user_status: "invited",
          personal_message: message.trim() || undefined,
        })
      } catch (error) {
        failures++
        // Detect seat-limit error and surface upgrade dialog
        try {
          const em = error instanceof Error ? error.message : String(error)
          const parsed = JSON.parse(em)
          if (parsed?.type === "SEAT_LIMIT_REACHED") {
            seatLimitHit = true
            setSeatLimitInfo({
              currentSeats: parsed.current_seats,
              seatLimit: parsed.seat_limit,
              isTrial: parsed.is_trial,
            })
          }
        } catch {
          /* not JSON */
        }
      }
    }

    setSubmitting(false)

    if (seatLimitHit) {
      setShowUpgradeDialog(true)
      return
    }

    if (failures === 0) {
      onClose()
    } else if (failures < emails.length) {
      toast({
        title: "Some invites failed",
        description: `${emails.length - failures} sent, ${failures} failed. Check and retry the rest.`,
        variant: "destructive",
      })
      // remove successful ones
      setChips((prev) => prev.slice(-failures))
    } else {
      toast({
        title: "Error",
        description: "Failed to send invitations. Please try again.",
        variant: "destructive",
      })
    }
  }

  const primaryLabel = isEditing
    ? "Save changes"
    : validChips.length > 1
      ? `Send ${validChips.length} invitations`
      : "Send invitation"

  return (
    <>
      <DialogPrimitive.Root open={isOpen} onOpenChange={(o) => !o && onClose()}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            className="fixed inset-0 z-[60] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
            style={{ background: "rgba(13,13,9,0.34)" }}
          />
          <DialogPrimitive.Content
            className="fixed left-1/2 top-1/2 z-[70] -translate-x-1/2 -translate-y-1/2 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
            style={{
              width: 600,
              maxWidth: "calc(100vw - 32px)",
              maxHeight: "calc(100vh - 48px)",
              background: "#ffffff",
              borderRadius: 18,
              boxShadow:
                "0 28px 90px -14px rgba(13,13,9,0.42), 0 0 0 1px rgba(13,13,9,0.04)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <DialogPrimitive.Title className="sr-only">
              {isEditing ? "Edit member" : `Invite people to ${orgName}`}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              {isEditing
                ? "Update this member's role."
                : "Invite one or more people to your workspace."}
            </DialogPrimitive.Description>

            {/* HEADER */}
            <header
              className="flex items-start gap-3 shrink-0"
              style={{
                padding: "20px 24px 18px",
                borderBottom: "1px solid #F1F0EC",
              }}
            >
              <span
                className="flex items-center justify-center shrink-0"
                style={{
                  height: 38,
                  width: 38,
                  background: "#EDE4FF",
                  borderRadius: 11,
                  color: "#6F3FF5",
                }}
              >
                <UserPlus style={{ height: 17, width: 17 }} strokeWidth={2} />
              </span>
              <div className="flex-1 min-w-0">
                <div
                  className="font-inter"
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    letterSpacing: "0.09em",
                    color: "#8B8F9E",
                    textTransform: "uppercase",
                  }}
                >
                  Workspace · Members
                </div>
                <h2
                  className="font-poppins truncate"
                  style={{
                    fontSize: 19,
                    fontWeight: 600,
                    letterSpacing: "-0.035em",
                    color: "#0d0d09",
                    marginTop: 2,
                  }}
                >
                  {isEditing ? "Edit member" : `Invite people to ${orgName}`}
                  <span style={{ color: "#D7C5FB" }}>.</span>
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex items-center justify-center shrink-0 rounded-md hover:bg-[#F1F0EC] transition-colors"
                style={{ height: 30, width: 30, color: "#8B8F9E" }}
              >
                <X style={{ height: 17, width: 17 }} strokeWidth={2} />
              </button>
            </header>

            {/* BODY */}
            <div
              className="flex-1 overflow-y-auto flex flex-col"
              style={{ padding: 24, gap: 20 }}
            >
              {/* 1. Email addresses */}
              {!isEditing && (
                <section className="flex flex-col" style={{ gap: 8 }}>
                  <div className="flex items-center justify-between">
                    <label
                      className="font-poppins"
                      style={{ fontSize: 12.5, fontWeight: 600, color: "#1F2230" }}
                    >
                      Email addresses
                    </label>
                    <span
                      className="font-inter"
                      style={{ fontSize: 11, color: "#8B8F9E" }}
                    >
                      Enter, comma, or space to add
                    </span>
                  </div>

                  <div
                    ref={chipContainerRef}
                    onClick={() => inputRef.current?.focus()}
                    className="flex flex-wrap items-center"
                    style={{
                      border: "1px solid #E0DDD3",
                      background: "#fff",
                      borderRadius: 10,
                      minHeight: 46,
                      padding: "8px 10px",
                      gap: 5,
                      cursor: "text",
                    }}
                  >
                    {chips.map((chip, idx) => {
                      const Icon = chip.valid ? Mail : AlertCircle
                      return (
                        <span
                          key={`${chip.value}-${idx}`}
                          className="inline-flex items-center font-inter"
                          style={{
                            height: 26,
                            borderRadius: 999,
                            padding: "0 6px 0 9px",
                            gap: 6,
                            fontSize: 12,
                            maxWidth: "100%",
                            background: chip.valid ? "#F1F0EC" : "#FFF5F5",
                            border: chip.valid ? "none" : "1px solid #F5C6C6",
                            color: chip.valid ? "#1F2230" : "#B4362F",
                          }}
                        >
                          <Icon
                            style={{
                              height: 12,
                              width: 12,
                              color: chip.valid ? "#8B8F9E" : "#B4362F",
                              flexShrink: 0,
                            }}
                          />
                          <span
                            className="truncate"
                            style={{ maxWidth: 220 }}
                            title={chip.value}
                          >
                            {chip.value}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeChip(idx)
                            }}
                            aria-label={`Remove ${chip.value}`}
                            className="flex items-center justify-center rounded-full hover:bg-black/5"
                            style={{
                              height: 16,
                              width: 16,
                              color: chip.valid ? "#8B8F9E" : "#B4362F",
                            }}
                          >
                            <X style={{ height: 11, width: 11 }} strokeWidth={2.5} />
                          </button>
                        </span>
                      )
                    })}
                    <input
                      ref={inputRef}
                      type="text"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onPaste={handlePaste}
                      onBlur={handleBlur}
                      placeholder={
                        chips.length === 0 ? "name@company.com" : "Add another…"
                      }
                      className="flex-1 outline-none border-none bg-transparent font-inter"
                      style={{
                        minWidth: 140,
                        fontSize: 13,
                        color: "#1F2230",
                        height: 26,
                      }}
                    />
                  </div>

                  {invalidChips.length > 0 ? (
                    <div
                      className="flex items-start font-inter"
                      style={{
                        gap: 8,
                        background: "#FFF5F5",
                        border: "1px solid #F5C6C6",
                        borderRadius: 8,
                        padding: "8px 10px",
                        fontSize: 11.5,
                        color: "#B4362F",
                      }}
                    >
                      <AlertTriangle
                        style={{ height: 13, width: 13, marginTop: 1, flexShrink: 0 }}
                      />
                      <span>
                        Some entries aren't valid email addresses. Fix or remove
                        the red chips before sending.
                      </span>
                    </div>
                  ) : hasPersonal ? (
                    <div
                      className="flex items-start font-inter"
                      style={{
                        gap: 8,
                        background: "#FFF9EE",
                        border: "1px solid #F5E4BE",
                        borderRadius: 8,
                        padding: "8px 10px",
                        fontSize: 11.5,
                        color: "#7A5510",
                      }}
                    >
                      <Info
                        style={{ height: 13, width: 13, marginTop: 1, flexShrink: 0 }}
                      />
                      <span>
                        One or more are personal email addresses. Allowed, but a
                        work email is recommended.
                      </span>
                    </div>
                  ) : null}
                </section>
              )}

              {/* 2. Role */}
              <section className="flex flex-col" style={{ gap: 8 }}>
                <div className="flex items-center" style={{ gap: 8 }}>
                  <label
                    className="font-poppins"
                    style={{ fontSize: 12.5, fontWeight: 600, color: "#1F2230" }}
                  >
                    Role
                  </label>
                  {!isEditing && (
                    <span
                      className="font-inter"
                      style={{ fontSize: 11.5, color: "#8B8F9E" }}
                    >
                      Applied to everyone in this invite
                    </span>
                  )}
                </div>

                <div className="flex flex-col" style={{ gap: 8 }}>
                  {roleOptions.map((r) => {
                    const selected = role === r.value
                    const Icon = r.icon
                    return (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setRole(r.value)}
                        className="flex items-center text-left transition-colors"
                        style={{
                          padding: "11px 12px",
                          borderRadius: 11,
                          gap: 12,
                          background: selected ? "#F5EFFF" : "#fff",
                          border: `1px solid ${selected ? "#DFCBFB" : "#EDECE6"}`,
                          boxShadow: selected
                            ? "inset 0 0 0 1px #DFCBFB"
                            : undefined,
                        }}
                        onMouseEnter={(e) => {
                          if (!selected)
                            e.currentTarget.style.background = "#FAFAF7"
                        }}
                        onMouseLeave={(e) => {
                          if (!selected)
                            e.currentTarget.style.background = "#fff"
                        }}
                      >
                        <span
                          className="flex items-center justify-center shrink-0"
                          style={{
                            height: 34,
                            width: 34,
                            borderRadius: 9,
                            background: selected ? "#EDE4FF" : "#F1F0EC",
                            color: selected ? "#6F3FF5" : "#5A6072",
                          }}
                        >
                          <Icon style={{ height: 16, width: 16 }} strokeWidth={2} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div
                            className="flex items-center"
                            style={{ gap: 8, marginBottom: 2 }}
                          >
                            <span
                              className="font-poppins"
                              style={{
                                fontSize: 13,
                                fontWeight: 500,
                                color: "#0d0d09",
                              }}
                            >
                              {r.label}
                            </span>
                            <span
                              className="font-inter"
                              style={{
                                fontSize: 9.5,
                                fontWeight: 600,
                                borderRadius: 999,
                                padding: "1px 7px",
                                background:
                                  r.seat === "paid" ? "#EDE4FF" : "#D1FAE5",
                                color:
                                  r.seat === "paid" ? "#5B21B6" : "#0B7A57",
                              }}
                            >
                              {r.seat === "paid" ? "Paid seat" : "Free"}
                            </span>
                          </div>
                          <div
                            className="font-inter"
                            style={{
                              fontSize: 11.5,
                              color: "#8B8F9E",
                              lineHeight: 1.4,
                            }}
                          >
                            {r.description}
                          </div>
                        </div>
                        <span
                          className="flex items-center justify-center shrink-0"
                          aria-hidden
                          style={{
                            height: 20,
                            width: 20,
                            borderRadius: 999,
                            background: selected ? "#6F3FF5" : "#fff",
                            border: selected
                              ? "1px solid #6F3FF5"
                              : "2px solid #C2C6D2",
                            color: "#fff",
                          }}
                        >
                          {selected && (
                            <Check style={{ height: 12, width: 12 }} strokeWidth={3} />
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>

              {/* 3. Personal message */}
              {!isEditing && (
                <section>
                  {!messageOpen ? (
                    <button
                      type="button"
                      onClick={() => setMessageOpen(true)}
                      className="inline-flex items-center font-poppins"
                      style={{
                        gap: 6,
                        fontSize: 12.5,
                        fontWeight: 500,
                        color: "#6F3FF5",
                      }}
                    >
                      <Plus style={{ height: 13, width: 13 }} strokeWidth={2.25} />
                      Add a personal message
                    </button>
                  ) : (
                    <div className="flex flex-col" style={{ gap: 6 }}>
                      <div className="flex items-center justify-between">
                        <div className="font-poppins" style={{ fontSize: 12.5 }}>
                          <span style={{ fontWeight: 600, color: "#1F2230" }}>
                            Personal message
                          </span>{" "}
                          <span style={{ fontWeight: 400, color: "#8B8F9E" }}>
                            · optional
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setMessage("")
                            setMessageOpen(false)
                          }}
                          className="font-inter hover:underline"
                          style={{ fontSize: 11.5, color: "#8B8F9E" }}
                        >
                          Remove
                        </button>
                      </div>
                      <textarea
                        rows={3}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Add a short note — it appears inside the invitation email."
                        className="font-inter resize-none outline-none"
                        style={{
                          background: "#fff",
                          border: "1px solid #E0DDD3",
                          borderRadius: 10,
                          fontSize: 13,
                          color: "#1F2230",
                          padding: "10px 12px",
                        }}
                      />
                    </div>
                  )}
                </section>
              )}
            </div>

            {/* FOOTER */}
            <footer
              className="flex items-center shrink-0"
              style={{
                padding: "13px 24px",
                borderTop: "1px solid #F1F0EC",
                background: "#FAFAF7",
                gap: 12,
              }}
            >
              {!isEditing && (
                <div
                  className="flex items-center font-inter"
                  style={{
                    gap: 6,
                    fontSize: 11.5,
                    color: overSeats ? "#B4362F" : "#8B8F9E",
                  }}
                >
                  {overSeats ? (
                    <>
                      <AlertCircle style={{ height: 12, width: 12 }} />
                      <span>
                        Only {seatsLeft} paid seats left — add more in Billing
                      </span>
                    </>
                  ) : (
                    <>
                      <Ticket style={{ height: 12, width: 12 }} />
                      <span>
                        {seatsLeft === Infinity || seatsLeft === null
                          ? "Unlimited paid seats available"
                          : `${seatsLeft} paid seats available`}
                      </span>
                    </>
                  )}
                </div>
              )}
              <div className="flex-1" />
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={submitting || isLoading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirm}
                icon={isEditing ? undefined : Send}
                disabled={!canConfirm}
                style={
                  !canConfirm ? { opacity: 0.4, pointerEvents: "none" } : undefined
                }
              >
                {submitting ? "Sending…" : primaryLabel}
              </Button>
            </footer>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <SeatLimitUpgradeDialog
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        currentTier={
          billing?.subscription_tier as
            | "solo"
            | "launch"
            | "growth"
            | "business"
            | null
        }
        currentSeats={seatLimitInfo?.currentSeats ?? 0}
        seatLimit={seatLimitInfo?.seatLimit ?? null}
      />
    </>
  )
}
