import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SearchCriteria } from '@/types/sourcing'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface EditableSearchCriteriaProps {
  criteria: SearchCriteria
  onChange: (criteria: SearchCriteria) => void
}

export function EditableSearchCriteria({
  criteria,
  onChange
}: EditableSearchCriteriaProps) {
  const [newSkill, setNewSkill] = useState('')
  const [newTitleKeyword, setNewTitleKeyword] = useState('')

  const handleAddSkill = () => {
    if (newSkill.trim() && !criteria.skills.includes(newSkill.trim())) {
      onChange({
        ...criteria,
        skills: [...criteria.skills, newSkill.trim()]
      })
      setNewSkill('')
    }
  }

  const handleRemoveSkill = (skill: string) => {
    onChange({
      ...criteria,
      skills: criteria.skills.filter(s => s !== skill)
    })
  }

  const handleAddTitleKeyword = () => {
    if (newTitleKeyword.trim()) {
      const currentKeywords = criteria.title_keywords || []
      if (!currentKeywords.includes(newTitleKeyword.trim())) {
        onChange({
          ...criteria,
          title_keywords: [...currentKeywords, newTitleKeyword.trim()]
        })
        setNewTitleKeyword('')
      }
    }
  }

  const handleRemoveTitleKeyword = (keyword: string) => {
    onChange({
      ...criteria,
      title_keywords: (criteria.title_keywords || []).filter(k => k !== keyword)
    })
  }

  return (
    <div className="space-y-4">
      {/* Skills */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Skills</Label>
        <div className="flex gap-2">
          <Input
            placeholder="Add a skill..."
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddSkill()
              }
            }}
            className="flex-1"
          />
          <Button size="sm" onClick={handleAddSkill}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {criteria.skills.map(skill => (
            <Badge key={skill} variant="secondary" className="gap-1">
              {skill}
              <button
                onClick={() => handleRemoveSkill(skill)}
                className="ml-1 hover:bg-destructive/10 rounded-sm"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      </div>

      {/* Job Title Keywords */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Job Title Keywords (Optional)</Label>
        <p className="text-xs text-muted-foreground">Add title variations to broaden your search</p>
        <div className="flex gap-2">
          <Input
            placeholder='e.g., "Senior Engineer", "Staff Developer"'
            value={newTitleKeyword}
            onChange={(e) => setNewTitleKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddTitleKeyword()
              }
            }}
            className="flex-1"
          />
          <Button size="sm" onClick={handleAddTitleKeyword}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {criteria.title_keywords && criteria.title_keywords.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {criteria.title_keywords.map(keyword => (
              <Badge key={keyword} variant="outline" className="gap-1">
                {keyword}
                <button
                  onClick={() => handleRemoveTitleKeyword(keyword)}
                  className="ml-1 hover:bg-destructive/10 rounded-sm"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Location */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Location</Label>
        <Input
          placeholder='e.g., "Remote - LATAM", "Mexico City", "United States"'
          value={criteria.location || ''}
          onChange={(e) => onChange({ ...criteria, location: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Tip: Use "LATAM", "EMEA", "APAC", or "NA" for regional searches
        </p>
      </div>

      {/* Salary Range */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Salary Range (Optional)</Label>
        <div className="grid grid-cols-3 gap-2">
          <Input
            type="number"
            placeholder="Min"
            value={criteria.salary_min || ''}
            onChange={(e) => onChange({ 
              ...criteria, 
              salary_min: e.target.value ? parseInt(e.target.value) : undefined 
            })}
          />
          <Input
            type="number"
            placeholder="Max"
            value={criteria.salary_max || ''}
            onChange={(e) => onChange({ 
              ...criteria, 
              salary_max: e.target.value ? parseInt(e.target.value) : undefined 
            })}
          />
          <Select
            value={criteria.currency || 'USD'}
            onValueChange={(value) => onChange({ ...criteria, currency: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
              <SelectItem value="MXN">MXN</SelectItem>
              <SelectItem value="GBP">GBP</SelectItem>
              <SelectItem value="CAD">CAD</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Experience Range */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Experience Years (Optional)</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder="Min"
            value={criteria.experience_years?.min || ''}
            onChange={(e) => onChange({
              ...criteria,
              experience_years: {
                ...criteria.experience_years,
                min: e.target.value ? parseInt(e.target.value) : undefined
              }
            })}
            min={0}
            max={30}
            className="w-24"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="number"
            placeholder="Max"
            value={criteria.experience_years?.max || ''}
            onChange={(e) => onChange({
              ...criteria,
              experience_years: {
                ...criteria.experience_years,
                max: e.target.value ? parseInt(e.target.value) : undefined
              }
            })}
            min={0}
            max={30}
            className="w-24"
          />
          <span className="text-sm text-muted-foreground">years</span>
        </div>
      </div>
    </div>
  )
}
