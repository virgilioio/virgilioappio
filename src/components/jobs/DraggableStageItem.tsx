import { useEffect, useRef, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, MoreHorizontal, Copy, Pencil, Trash2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface JobStage {
  id: string
  stage_name: string
  stage_type: string
  stage_description?: string
  is_default: boolean
  stage_priority?: number | string
}

interface DraggableStageItemProps {
  stage: JobStage
  index: number
  onRemove: (instanceId: string) => void
  onConfigure?: (jhsId: string) => void
  onDuplicate?: (stageId: string) => void
  instanceId: string
  jhsId?: string
  customStageName?: string | null
  isDragging?: boolean
  locked?: boolean
}

const STAGE_COLORS = [
  '#6F3FF5', // purple
  '#3B82F6', // blue
  '#EC4899', // pink
  '#F97316', // orange
  '#F59E0B', // amber
  '#10B981', // emerald
  '#8B5CF6', // violet
]

const SLA_BY_TYPE: Record<string, string> = {
  application: 'Within 48h',
  application_review: 'Within 48h',
  screening: '5 days',
  assessment: '7 days',
  interview: '10 days',
  reference_check: '3 days',
  offer: '5 days',
}

const SUBTITLE_BY_TYPE: Record<string, string> = {
  application: 'Auto-screened by Gio',
  application_review: 'Auto-screened by Gio',
  screening: '30 min · Recruiter',
  assessment: '5–7 day async',
  interview: 'Half-day · panel',
  reference_check: '2 references · async',
  offer: 'System stage · auto',
  onboarding: 'System stage · auto',
  custom: 'Custom stage',
}

const AI_TYPES = new Set(['application', 'application_review'])

export function DraggableStageItem({
  stage,
  index,
  onRemove,
  onConfigure,
  onDuplicate,
  instanceId,
  jhsId,
  customStageName,
  isDragging,
  locked,
}: DraggableStageItemProps) {
  const isSystem = locked ?? stage.is_default
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: instanceId, disabled: isSystem })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: (isDragging || isSortableDragging) ? 0 : undefined,
  }

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const color = STAGE_COLORS[index % STAGE_COLORS.length]
  const sub = stage.stage_description || SUBTITLE_BY_TYPE[stage.stage_type] || stage.stage_type.replace('_', ' ')
  const sla = SLA_BY_TYPE[stage.stage_type]
  const isAI = AI_TYPES.has(stage.stage_type)
  const name = customStageName || stage.stage_name

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: 'grid',
        gridTemplateColumns: 'auto 24px minmax(0,1fr) auto auto',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        border: '1px solid #E7E8EE',
        borderRadius: 10,
        position: 'relative',
        background: isSystem ? '#FAFAF7' : '#ffffff',
      }}
    >
      {/* 1. Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        disabled={isSystem}
        className={cn(
          'flex items-center justify-center bg-transparent border-0 p-0 -ml-1',
          isSystem ? 'cursor-not-allowed opacity-50' : 'cursor-grab active:cursor-grabbing'
        )}
        style={{ width: 14, height: 20 }}
      >
        <GripVertical style={{ width: 14, height: 14, color: '#C2C6D2' }} />
      </button>

      {/* 2. Number chip */}
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: 999,
          background: color,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Poppins, sans-serif',
          fontSize: 11,
          fontWeight: 600,
          lineHeight: 1,
        }}
      >
        {index + 1}
      </div>

      {/* 3. Label block */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            className="font-inter truncate"
            style={{ fontSize: 13, fontWeight: 500, color: '#1F2230' }}
          >
            {name}
          </span>
          {isSystem && (
            <span
              className="font-inter"
              style={{
                background: '#F1F0EC',
                color: '#5A6072',
                fontSize: 10,
                fontWeight: 500,
                borderRadius: 6,
                padding: '2px 6px',
                lineHeight: 1.2,
              }}
            >
              Required
            </span>
          )}
          {isAI && (
            <span
              className="font-inter inline-flex items-center gap-1"
              style={{
                background: '#EDE4FF',
                color: '#6F3FF5',
                fontSize: 10,
                fontWeight: 500,
                borderRadius: 6,
                padding: '2px 6px',
                lineHeight: 1.2,
              }}
            >
              <Sparkles style={{ width: 8, height: 8 }} />
              AI
            </span>
          )}
        </div>
        <div
          className="font-inter truncate"
          style={{ fontSize: 11, color: '#8B8F9E', marginTop: 2 }}
        >
          {sub}
        </div>
      </div>

      {/* 4. SLA badge */}
      {sla ? (
        <span
          className="font-inter"
          style={{
            background: '#FBEBC6',
            color: '#B45309',
            fontSize: 10,
            fontWeight: 500,
            borderRadius: 6,
            padding: '3px 7px',
            whiteSpace: 'nowrap',
            lineHeight: 1.2,
          }}
        >
          SLA {sla}
        </span>
      ) : (
        <span />
      )}

      {/* 5. Row menu */}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          aria-label="Row actions"
          onClick={(e) => {
            e.stopPropagation()
            setMenuOpen((v) => !v)
          }}
          className="flex items-center justify-center transition-colors"
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: menuOpen ? '#F1F0EC' : 'transparent',
            border: 0,
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#F1F0EC')}
          onMouseLeave={(e) => (e.currentTarget.style.background = menuOpen ? '#F1F0EC' : 'transparent')}
        >
          <MoreHorizontal style={{ width: 16, height: 16, color: '#8B8F9E' }} />
        </button>

        {menuOpen && (
          <>
            <div
              onClick={() => setMenuOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 40 }}
            />
            <div
              ref={menuRef}
              style={{
                position: 'absolute',
                top: 'calc(100% - 4px)',
                right: 0,
                zIndex: 50,
                width: 176,
                background: '#fff',
                border: '1px solid #EDECE6',
                borderRadius: 12,
                boxShadow:
                  '0 16px 40px -8px rgba(13,13,9,0.24), 0 0 0 1px rgba(13,13,9,0.03)',
                padding: 5,
              }}
            >
              <MenuItem
                icon={<Copy style={{ width: 14, height: 14, color: '#5A6072' }} />}
                label="Duplicate"
                onClick={() => {
                  setMenuOpen(false)
                  onDuplicate?.(stage.id)
                }}
              />
              <MenuItem
                icon={<Pencil style={{ width: 14, height: 14, color: '#5A6072' }} />}
                label="Edit"
                disabled={!jhsId || !onConfigure}
                onClick={() => {
                  setMenuOpen(false)
                  if (jhsId && onConfigure) onConfigure(jhsId)
                }}
              />
              {!isSystem && (
                <>
                  <div style={{ height: 1, background: '#F1F0EC', margin: '4px 2px' }} />
                  <MenuItem
                    icon={<Trash2 style={{ width: 14, height: 14, color: '#B91C1C' }} />}
                    label="Delete"
                    danger
                    onClick={() => {
                      setMenuOpen(false)
                      onRemove(instanceId)
                    }}
                  />
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
  disabled,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full font-inter transition-colors flex items-center"
      style={{
        gap: 10,
        padding: '8px 10px',
        borderRadius: 8,
        border: 0,
        background: 'transparent',
        color: danger ? '#B91C1C' : '#1F2230',
        fontSize: 12.5,
        fontWeight: 500,
        textAlign: 'left',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={(e) => {
        if (disabled) return
        e.currentTarget.style.background = danger ? '#FEF2F2' : '#FAFAF7'
      }}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
