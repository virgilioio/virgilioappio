import * as React from 'react'
import { Clock, Heart, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

/**
 * Cell atoms shared by every flat pipeline section (Application review, Job
 * offers, Hired, Rejected). One visual truth — configs only choose which
 * atoms appear in which column.
 */

export const PS_INK = '#0d0d09'
export const PS_TEXT = '#1F2230'
export const PS_MUTED = '#5A6072'
export const PS_TERTIARY = '#8B8F9E'
export const PS_HAIRLINE = '#E7E8EE'
export const PS_ROWLINE = '#F1F0EC'
export const PS_SAND = '#FAFAF7'
export const PS_LILAC = '#FAF8FF'
export const PS_PURPLE = '#6F3FF5'
export const PS_RED = '#FA5252'
export const PS_GREEN = '#12B886'
export const PS_AMBER = '#F59E0B'
export const PS_TEAL = '#0B7285'
export const PS_RUST = '#C2410C'

const inter = "'Inter', system-ui, sans-serif"
const poppins = "'Poppins', system-ui, sans-serif"

export const psScore = (s: number | null | undefined) =>
  typeof s !== 'number' ? PS_MUTED : s >= 85 ? PS_GREEN : s >= 70 ? PS_AMBER : PS_MUTED

export const psStale = (days: number | null | undefined) => typeof days === 'number' && days > 7

const ellipsis: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

export function PSName({
  name,
  role,
  company,
  favorite,
}: {
  name: string
  role?: string | null
  company?: string | null
  favorite?: boolean
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <span
          style={{
            fontFamily: poppins,
            fontWeight: 600,
            fontSize: 13,
            letterSpacing: '-0.005em',
            color: PS_INK,
            ...ellipsis,
          }}
        >
          {name}
        </span>
        {favorite && <Heart size={11} color={PS_RED} fill={PS_RED} style={{ flexShrink: 0 }} />}
      </div>
      {(role || company) && (
        <div
          style={{
            marginTop: 1,
            fontFamily: inter,
            fontSize: 11.5,
            color: PS_MUTED,
            ...ellipsis,
          }}
        >
          {role || ''}
          {role && company && <span style={{ color: PS_TERTIARY }}> @ </span>}
          {company && <span style={{ color: PS_TEXT, fontWeight: 500 }}>{company}</span>}
        </div>
      )}
    </div>
  )
}

export function PSMatch({ score }: { score?: number | null }) {
  if (typeof score !== 'number') {
    return (
      <div style={{ textAlign: 'right', fontFamily: inter, fontSize: 12, color: PS_TERTIARY }}>—</div>
    )
  }
  const color = psScore(score)
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
      <Sparkles size={11} strokeWidth={2.25} color={color} />
      <span
        style={{
          fontFamily: poppins,
          fontWeight: 600,
          fontSize: 13.5,
          letterSpacing: '-0.02em',
          color,
        }}
      >
        {Math.round(score)}
      </span>
    </div>
  )
}

export function PSAge({ days, qualifier }: { days?: number | null; qualifier?: string }) {
  if (typeof days !== 'number') {
    return <span style={{ fontFamily: inter, fontSize: 12, color: PS_TERTIARY }}>—</span>
  }
  const stale = psStale(days)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
      {stale && <Clock size={11} strokeWidth={2.2} color={PS_RED} style={{ flexShrink: 0 }} />}
      <span style={{ fontFamily: inter, fontSize: 12, ...ellipsis }}>
        <span style={{ color: stale ? PS_RED : PS_TEXT, fontWeight: stale ? 600 : 400 }}>
          {days}d
        </span>
        {qualifier && <span style={{ color: PS_TERTIARY, fontWeight: 400 }}>{qualifier}</span>}
      </span>
    </div>
  )
}

export interface PSStatusValue {
  label: string
  icon: LucideIcon
  color: string
  note?: string | null
}

export function PSStatus({ value }: { value?: PSStatusValue | null }) {
  if (!value) {
    return <span style={{ fontFamily: inter, fontSize: 12, color: PS_TERTIARY }}>—</span>
  }
  const Icon = value.icon
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
        <Icon size={11} strokeWidth={2} color={value.color} style={{ flexShrink: 0 }} />
        <span
          style={{
            fontFamily: inter,
            fontWeight: 500,
            fontSize: 11.5,
            color: value.color,
            ...ellipsis,
          }}
        >
          {value.label}
        </span>
      </div>
      {value.note && (
        <div
          style={{
            marginTop: 2,
            fontFamily: inter,
            fontSize: 10.5,
            color: PS_TERTIARY,
            ...ellipsis,
          }}
        >
          {value.note}
        </div>
      )}
    </div>
  )
}

export function PSOwner({ name, avatarUrl }: { name?: string | null; avatarUrl?: string | null }) {
  if (!name) {
    return <span style={{ fontFamily: inter, fontSize: 11.5, color: PS_TERTIARY }}>—</span>
  }
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
      <Avatar style={{ width: 20, height: 20, flexShrink: 0 }}>
        {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
        <AvatarFallback style={{ fontSize: 9, fontFamily: inter }}>{initials}</AvatarFallback>
      </Avatar>
      <span style={{ fontFamily: inter, fontSize: 11.5, color: PS_MUTED, ...ellipsis }}>{name}</span>
    </div>
  )
}

export function PSText({
  children,
  tone = 'default',
  strong,
}: {
  children: React.ReactNode
  tone?: 'default' | 'muted' | 'tert'
  strong?: boolean
}) {
  const color = tone === 'muted' ? PS_MUTED : tone === 'tert' ? PS_TERTIARY : PS_TEXT
  if (children === null || children === undefined || children === '') {
    return <span style={{ fontFamily: inter, fontSize: 12, color: PS_TERTIARY }}>—</span>
  }
  if (strong) {
    return (
      <div
        style={{
          fontFamily: poppins,
          fontWeight: 600,
          fontSize: 12.5,
          letterSpacing: '-0.01em',
          color: PS_INK,
          ...ellipsis,
        }}
      >
        {children}
      </div>
    )
  }
  return <div style={{ fontFamily: inter, fontSize: 12, color, ...ellipsis }}>{children}</div>
}

export function PSCheck({
  checked,
  onChange,
  visible,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  visible: boolean
}) {
  return (
    <div
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 100ms ease',
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer',
      }}
    >
      <span
        role="checkbox"
        aria-checked={checked}
        style={{
          width: 14,
          height: 14,
          borderRadius: 4,
          border: checked ? '1.5px solid #0d0d09' : '1.5px solid #C2C6D2',
          background: checked ? PS_INK : '#fff',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {checked && (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fffcf9" strokeWidth={3}>
            <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </div>
  )
}
