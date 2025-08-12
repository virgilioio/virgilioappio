import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { CategorizedSkill } from '@/hooks/useSkillsGeneration'
import { useSkillsGeneration } from '@/hooks/useSkillsGeneration'

interface JobSkillsGenerationPanelProps {
  descriptionHtml: string
  title: string
  existingSkills: string[]
  onAccept: (skills: string[]) => void
  onGenerated?: (items: CategorizedSkill[]) => void
}

function extractPlainText(html: string): string {
  try {
    const div = document.createElement('div')
    div.innerHTML = html || ''
    return (div.textContent || div.innerText || '').trim()
  } catch {
    return html || ''
  }
}

export function JobSkillsGenerationPanel({ descriptionHtml, title, existingSkills, onAccept, onGenerated }: JobSkillsGenerationPanelProps) {
  const { generateSkills, isGenerating, generatedSkills, clearGeneratedSkills } = useSkillsGeneration()
  const [hasGenerated, setHasGenerated] = useState(false)

  const handleGenerate = async () => {
    const text = extractPlainText(descriptionHtml)
    if (!text || text.length < 10) return
    const res = await generateSkills(text, title)
    if (res?.skills) {
      setHasGenerated(true)
      onGenerated?.(res.skills)
    }
  }

  const handleAcceptAll = () => {
    const names = (generatedSkills || []).map(s => s.name).filter(Boolean)
    const unique = Array.from(new Set([...(existingSkills || []), ...names]))
    onAccept(unique)
  }

  if (!descriptionHtml) {
    return null
  }

  return (
    <Card className="mt-2">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm text-text-secondary">Use AI to extract skills from the description</div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? 'Generating…' : 'Generate skills'}
            </Button>
            {hasGenerated && (
              <Button type="button" onClick={handleAcceptAll}>Accept all</Button>
            )}
          </div>
        </div>
        {hasGenerated && (
          <div className="text-sm text-text-secondary">
            Preview generated skills: {(generatedSkills || []).slice(0, 12).map(s => s.name).filter(Boolean).join(', ')}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
