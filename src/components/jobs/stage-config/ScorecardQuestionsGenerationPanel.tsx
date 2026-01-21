import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Sparkles, Loader2, Plus, ChevronDown, ChevronUp, Lightbulb, MessageSquare } from 'lucide-react'
import { useScorecardQuestionsGeneration, type GeneratedQuestion } from '@/hooks/useScorecardQuestionsGeneration'
import type { InterviewQuestion } from '@/hooks/useScorecardsConfiguration'

interface ScorecardQuestionsGenerationPanelProps {
  jobId: string
  stageName: string
  stageType: string
  existingQuestions: InterviewQuestion[]
  onAddQuestions: (questions: Omit<InterviewQuestion, 'id'>[]) => Promise<void>
  isAdding: boolean
}

export function ScorecardQuestionsGenerationPanel({
  jobId,
  stageName,
  stageType,
  existingQuestions,
  onAddQuestions,
  isAdding
}: ScorecardQuestionsGenerationPanelProps) {
  const {
    generatedQuestions,
    isGenerating,
    generateQuestions,
    clearGenerated
  } = useScorecardQuestionsGeneration()

  const [selectedQuestions, setSelectedQuestions] = useState<Set<number>>(new Set())
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set())

  const handleGenerate = async () => {
    const existingTexts = existingQuestions.map(q => q.question_text)
    await generateQuestions({
      jobId,
      stageName,
      stageType,
      existingQuestions: existingTexts
    })
    setSelectedQuestions(new Set())
    setExpandedQuestions(new Set())
  }

  const toggleSelection = (index: number) => {
    const newSelected = new Set(selectedQuestions)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedQuestions(newSelected)
  }

  const toggleExpanded = (index: number) => {
    const newExpanded = new Set(expandedQuestions)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedQuestions(newExpanded)
  }

  const selectAll = () => {
    setSelectedQuestions(new Set(generatedQuestions.map((_, i) => i)))
  }

  const deselectAll = () => {
    setSelectedQuestions(new Set())
  }

  const handleAddSelected = async () => {
    const questionsToAdd: Omit<InterviewQuestion, 'id'>[] = []
    const nextOrder = existingQuestions.length > 0 
      ? Math.max(...existingQuestions.map(q => q.display_order)) + 1 
      : 1

    const sortedIndices = Array.from(selectedQuestions).sort((a, b) => a - b)
    
    sortedIndices.forEach((index, i) => {
      const q = generatedQuestions[index]
      questionsToAdd.push({
        question_text: q.question_text,
        answer_type: q.answer_type,
        notes_for_interviewer: q.notes_for_interviewer,
        is_required: false,
        display_order: nextOrder + i
      })
    })

    await onAddQuestions(questionsToAdd)
    setSelectedQuestions(new Set())
    clearGenerated()
  }

  const hasGeneratedQuestions = generatedQuestions.length > 0
  const selectedCount = selectedQuestions.size

  return (
    <Card className="border-dashed border-virgilio-purple/30 bg-gradient-to-b from-virgilio-purple/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-5 w-5 text-virgilio-purple" />
            AI Question Generator
          </CardTitle>
          <div className="flex gap-2">
            {!hasGeneratedQuestions ? (
              <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                size="sm"
                className="bg-virgilio-purple hover:bg-virgilio-purple/90"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Questions
                  </>
                )}
              </Button>
            ) : (
              <>
                <Button
                  onClick={clearGenerated}
                  variant="outline"
                  size="sm"
                  disabled={isAdding}
                >
                  Clear
                </Button>
                <Button
                  onClick={handleAddSelected}
                  disabled={selectedCount === 0 || isAdding}
                  size="sm"
                >
                  {isAdding ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Add Selected ({selectedCount})
                </Button>
              </>
            )}
          </div>
        </div>
        {!hasGeneratedQuestions && (
          <p className="text-sm text-muted-foreground mt-1">
            Generate tailored interview questions for the "{stageName}" stage
          </p>
        )}
      </CardHeader>

      {hasGeneratedQuestions && (
        <CardContent className="pt-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">
              {generatedQuestions.length} questions generated
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={selectAll}>
                Select All
              </Button>
              <Button variant="ghost" size="sm" onClick={deselectAll}>
                Deselect All
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {generatedQuestions.map((question, index) => {
              const isSelected = selectedQuestions.has(index)
              const isExpanded = expandedQuestions.has(index)

              return (
                <div
                  key={index}
                  className={`border rounded-lg p-3 transition-colors ${
                    isSelected 
                      ? 'border-virgilio-purple bg-virgilio-purple/5' 
                      : 'border-virgilio-border hover:border-virgilio-purple/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelection(index)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-virgilio-text">
                          {question.question_text}
                        </p>
                        <Badge 
                          variant="outline" 
                          className="shrink-0 text-xs"
                        >
                          {question.answer_type === 'yes_no' ? 'Yes/No' : 'Text'}
                        </Badge>
                      </div>
                      
                      <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(index)}>
                        <CollapsibleTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 px-0 text-xs text-muted-foreground hover:text-virgilio-text mt-1"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="h-3 w-3 mr-1" />
                                Hide details
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-3 w-3 mr-1" />
                                Show details
                              </>
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2 space-y-2">
                          <div className="flex items-start gap-2 text-sm">
                            <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-medium text-virgilio-text">Why this question: </span>
                              <span className="text-muted-foreground">{question.suggested_reason}</span>
                            </div>
                          </div>
                          <div className="flex items-start gap-2 text-sm">
                            <MessageSquare className="h-4 w-4 text-virgilio-purple shrink-0 mt-0.5" />
                            <div>
                              <span className="font-medium text-virgilio-text">Interviewer notes: </span>
                              <span className="text-muted-foreground">{question.notes_for_interviewer}</span>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
