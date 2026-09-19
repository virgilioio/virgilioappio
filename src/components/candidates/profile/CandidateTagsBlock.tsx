import { Plus } from 'lucide-react'
import { SidebarBlock } from './primitives/ProfileSidebar'
import { Button } from '@/components/ui/button'
import { TagChip } from '@/components/candidates/tags/TagChip'
import { AddTagPopover } from '@/components/candidates/tags/AddTagPopover'
import { useTags, useCandidateTagsMap } from '@/hooks/useTags'

/**
 * Tags sidebar block — rescued from the deleted in-job Overview tab.
 * Reads existing tag data only; the Add action reuses the shared AddTagPopover.
 */
export function CandidateTagsBlock({
  candidateId,
  candidateName,
}: {
  candidateId: string
  candidateName?: string | null
}) {
  const { tags } = useTags()
  const { data: mapByCand } = useCandidateTagsMap(candidateId ? [candidateId] : [])
  const assignedIds = mapByCand?.[candidateId] ?? []
  const assigned = assignedIds
    .map((id) => tags.find((t) => t.id === id))
    .filter(Boolean) as { id: string; name: string; color?: string | null }[]

  return (
    <SidebarBlock
      label="Tags"
      action={
        <AddTagPopover
          candidateIds={[candidateId]}
          candidateNames={candidateName ? [candidateName] : undefined}
          trigger={
            <Button variant="ghost" size="xs" icon={Plus}>
              Add
            </Button>
          }
        />
      }
    >
      {assigned.length ? (
        <div className="flex flex-wrap gap-1.5">
          {assigned.map((t) => (
            <TagChip key={t.id} name={t.name} color={t.color} />
          ))}
        </div>
      ) : (
        <div className="font-inter text-[12px] text-[#8B8F9E]">No tags</div>
      )}
    </SidebarBlock>
  )
}
