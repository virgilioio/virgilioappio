import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Lock, Globe, Plus, Pencil, Copy, Trash2, Check, Star } from 'lucide-react'
import { useSavedViews, type SavedView, type ViewVisibility } from '@/hooks/useSavedViews'
import { useAuth } from '@/contexts/AuthContext'

interface Props {
  activeViewId: string | null
  onActivate: (view: SavedView | null) => void
  // current state to persist when user creates/duplicates
  currentFilters: Record<string, unknown>
  currentExtraState: Record<string, unknown>
}

export function AnalyticsViewSwitcher({ activeViewId, onActivate, currentFilters, currentExtraState }: Props) {
  const { user } = useAuth()
  const { views, createView, updateView, deleteView } = useSavedViews('analytics')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const active = views.find(v => v.id === activeViewId) ?? null
  const [editName, setEditName] = useState('')

  useEffect(() => {
    setEditName(active?.name ?? '')
  }, [active?.id])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const own = views.filter(v => v.user_id === user?.id)
  const shared = views.filter(v => v.visibility === 'shared')
  const isOwner = active && active.user_id === user?.id

  const VisIcon = active?.visibility === 'shared' ? Globe : Lock
  const visColor = active?.visibility === 'shared' ? '#12B886' : '#8B8F9E'

  const commitRename = () => {
    if (!active || !isOwner) return
    const next = editName.trim()
    if (next && next !== active.name) updateView.mutate({ id: active.id, name: next })
  }

  const toggleVisibility = () => {
    if (!active || !isOwner) return
    const v: ViewVisibility = active.visibility === 'shared' ? 'private' : 'shared'
    updateView.mutate({ id: active.id, visibility: v })
  }

  const duplicate = () => {
    if (!active) return
    createView.mutate(
      {
        name: `${active.name} (copy)`,
        filters: active.filters,
        extra_state: active.extra_state ?? {},
        sort_state: active.sort_state ?? undefined,
        visibility: 'private',
      },
      { onSuccess: v => onActivate(v) },
    )
  }

  const createBlank = () => {
    createView.mutate(
      { name: 'New view', filters: currentFilters, extra_state: { ...currentExtraState, widgets: [] } },
      { onSuccess: v => onActivate(v) },
    )
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-2 h-9 px-3 rounded-[8px] border border-[#E7E8EE] bg-white hover:bg-[#FAFAF7] transition-colors"
      >
        <VisIcon size={13} style={{ color: visColor }} />
        <span className="font-poppins font-semibold text-[13px] text-[#0d0d09]">{active?.name ?? 'Select a view'}</span>
        <ChevronDown size={13} className="text-[#8B8F9E]" />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-[300px] z-40 bg-white rounded-[12px] border border-[#E7E8EE] shadow-[0_12px_32px_-8px_rgba(13,13,9,0.18)] p-2">
          {active && (
            <div className="p-2 border-b border-[#F1F0EC] mb-1">
              {isOwner ? (
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={e => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                  }}
                  className="w-full h-8 px-2 rounded-[7px] border border-[#E7E8EE] text-[12.5px] font-poppins font-semibold text-[#0d0d09] focus:outline-none focus:ring-2 focus:ring-[#6F3FF5]/30"
                />
              ) : (
                <div className="px-2 py-1 font-poppins font-semibold text-[12.5px] text-[#0d0d09]">{active.name}</div>
              )}
              {isOwner && (
                <div className="flex items-center gap-1 mt-2">
                  <MiniAction icon={active.visibility === 'shared' ? Lock : Globe} label={active.visibility === 'shared' ? 'Make private' : 'Make shared'} onClick={toggleVisibility} />
                  <MiniAction icon={Copy} label="Duplicate" onClick={duplicate} />
                  <MiniAction
                    icon={Star}
                    label={active.is_default ? 'Default' : 'Set default'}
                    onClick={() => updateView.mutate({ id: active.id, is_default: !active.is_default })}
                    highlight={active.is_default}
                  />
                  {!active.is_default && (
                    <MiniAction
                      icon={Trash2}
                      label="Delete"
                      onClick={() => {
                        deleteView.mutate(active.id, {
                          onSuccess: () => onActivate(views.find(v => v.id !== active.id) ?? null),
                        })
                      }}
                      danger
                    />
                  )}
                </div>
              )}
              <div className="text-[10.5px] font-inter text-[#8B8F9E] mt-2 px-1">
                {active.visibility === 'shared'
                  ? 'Shared — anyone with Analytics access sees this view.'
                  : 'Private — only you can see this view.'}
              </div>
            </div>
          )}

          {shared.length > 0 && <GroupLabel>Shared</GroupLabel>}
          {shared.map(v => (
            <ViewRow key={v.id} view={v} active={v.id === activeViewId} onClick={() => { onActivate(v); setOpen(false) }} />
          ))}

          {own.length > 0 && <GroupLabel>Private</GroupLabel>}
          {own.map(v => (
            <ViewRow key={v.id} view={v} active={v.id === activeViewId} onClick={() => { onActivate(v); setOpen(false) }} />
          ))}

          <div className="border-t border-[#F1F0EC] mt-1 pt-1">
            <button
              onClick={createBlank}
              className="w-full inline-flex items-center gap-2 h-8 px-2 rounded-[7px] text-[12.5px] font-inter text-[#0d0d09] hover:bg-[#F1F0EC]"
            >
              <Plus size={13} />
              New blank view
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-2 pt-2 pb-1 text-[10px] font-inter font-medium uppercase tracking-[0.06em] text-[#8B8F9E]">{children}</div>
}

function ViewRow({ view, active, onClick }: { view: SavedView; active: boolean; onClick: () => void }) {
  const Icon = view.visibility === 'shared' ? Globe : Lock
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-2 h-8 px-2 rounded-[7px] text-[12.5px] font-inter ${active ? 'bg-[#EDE4FF] text-[#5B21B6]' : 'text-[#0d0d09] hover:bg-[#F1F0EC]'}`}>
      <Icon size={12} className={view.visibility === 'shared' ? 'text-[#12B886]' : 'text-[#8B8F9E]'} />
      <span className="flex-1 text-left truncate">{view.name}</span>
      {view.is_default && <Star size={11} className="text-[#B45309]" />}
      {active && <Check size={12} />}
    </button>
  )
}

function MiniAction({ icon: Icon, label, onClick, highlight, danger }: { icon: any; label: string; onClick: () => void; highlight?: boolean; danger?: boolean }) {
  const cls = danger
    ? 'text-[#FA5252] hover:bg-[#FBE0E0]'
    : highlight
    ? 'bg-[#EDE4FF] text-[#5B21B6]'
    : 'text-[#5A6072] hover:bg-[#F1F0EC]'
  return (
    <button onClick={onClick} title={label} aria-label={label} className={`inline-flex items-center gap-1 h-7 px-2 rounded-[6px] text-[11px] font-inter font-medium transition-colors ${cls}`}>
      <Icon size={11} />
      {label}
    </button>
  )
}
