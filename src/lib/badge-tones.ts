/**
 * Gio Foundation v1.0 — Badge tone map.
 * Single source of truth for "which color means what" across the app.
 * See docs/style-guide.md → Badges & tags → By use case.
 */
import type { BadgeTone } from "@/components/ui/badge"

export const JOB_STATUS_TONE: Record<string, BadgeTone> = {
  open: "green",
  paused: "yellow",
  draft: "neutral",
  closed: "red",
  archived: "neutral",
}

export const CANDIDATE_STAGE_TONE: Record<string, BadgeTone> = {
  sourced: "neutral",
  applicationReview: "neutral",
  phoneScreen: "blue",
  takeHome: "blue",
  onsite: "blue",
  offer: "orange",
  hired: "green",
  rejected: "red",
}

export const ROLE_TONE: Record<string, BadgeTone> = {
  owner: "ink",
  admin: "blue",
  recruiter: "purple",
  hiringManager: "orange",
  interviewer: "neutral",
  sales: "lilac",
}

export const INTEGRATION_TONE: Record<string, BadgeTone> = {
  connected: "green",
  actionNeeded: "yellow",
  beta: "lilac",
  notConnected: "neutral",
  error: "red",
  expired: "yellow",
}

export const BILLING_TONE: Record<string, BadgeTone> = {
  currentPlan: "ink",
  trial: "lilac",
  paid: "green",
  refunded: "neutral",
  pastDue: "red",
}

export const SCORECARD_TONE: Record<string, BadgeTone> = {
  strongYes: "green",
  yes: "green",
  leanYes: "green",
  neutral: "neutral",
  leanNo: "red",
  no: "red",
  strongNo: "red",
}

/** AI fit score → tone, on the dossier's own bands (90 exceptional, 75 strong,
 *  60 mixed, 40 weak; aligned 2026-10-14). Always render the numeric score next to the badge. */
export function aiFitTone(score: number): BadgeTone {
  if (score >= 90) return "green"
  if (score >= 75) return "blue"
  if (score >= 60) return "yellow"
  if (score >= 40) return "orange"
  return "red"
}
