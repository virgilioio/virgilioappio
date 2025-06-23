import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useAgreements } from '@/hooks/useAgreements'
import { useMembersWithProfiles } from '@/hooks/useMembersWithProfiles'
import {
  EditorContent,
  FloatingMenu,
  BubbleMenu,
  useEditor,
} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import Italic from '@tiptap/extension-italic'
import Bold from '@tiptap/extension-bold'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { Color } from '@tiptap/extension-color'
import TextStyle from '@tiptap/extension-text-style'
import { cn } from '@/lib/utils'

const formSchema = z.object({
  title: z.string().min(2, {
    message: 'Job title must be at least 2 characters.',
  }),
  description: z.string().min(10, {
    message: 'Job description must be at least 10 characters.',
  }),
  level: z.enum(['L1', 'L2', 'L3']).default('L1'),
  location: z.string().min(2, {
    message: 'Location must be at least 2 characters.',
  }),
  salary_min: z.number().optional(),
  salary_max: z.number().optional(),
  currency: z.string().optional(),
  agreement_id: z.string().optional(),
  hiring_team: z.array(z.string()).optional(),
  is_urgent: z.boolean().default(false),
  notes: z.string().optional(),
})

interface JobFormProps {
  onSubmit: (values: z.infer<typeof formSchema>) => Promise<void>
  onCancel: () => void
  isLoading: boolean
  agreementContent?: string
}

export function JobForm({
  onSubmit,
  onCancel,
  isLoading,
  agreementContent,
}: JobFormProps) {
  const { toast } = useToast()
  const { profile } = useUserProfile()
  const { agreements } = useAgreements()
  const { members, isLoading: loadingMembers } = useMembersWithProfiles()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      level: 'L1',
      location: '',
      salary_min: 50000,
      salary_max: 100000,
      currency: 'USD',
      agreement_id: '',
      hiring_team: [],
      is_urgent: false,
      notes: '',
    },
  })

  const hiringTeamValue = form.watch('hiring_team')
  const currentHiringTeam = Array.isArray(hiringTeamValue) ? hiringTeamValue : []

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Italic,
      Bold,
      Link.configure({
        openOnClick: false,
      }),
      Image,
      Color,
      TextStyle,
      Placeholder.configure({
        placeholder: 'Type something here...',
      }),
    ],
    content: agreementContent || '<p>No agreement content loaded</p>',
    editable: false,
  })

  const handleParsedSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!profile) {
      toast({
        title: 'Error',
        description: 'Could not submit job. User profile not found.',
        variant: 'destructive',
      })
      return
    }

    if (!editor) {
      toast({
        title: 'Error',
        description: 'Could not submit job. Agreement content editor not loaded.',
        variant: 'destructive',
      })
      return
    }

    const processed_agreement_content = editor.getHTML()

    await onSubmit({
      ...values,
      salary_min: Number(values.salary_min),
      salary_max: Number(values.salary_max),
      agreement_id: values.agreement_id || '',
      processed_agreement_content,
    })
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleParsedSubmit)}
        className="space-y-8"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Job Title</FormLabel>
                <FormControl>
                  <Input placeholder="Software Engineer" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="level"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Level</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a level" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="L1">L1</SelectItem>
                    <SelectItem value="L2">L2</SelectItem>
                    <SelectItem value="L3">L3</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <FormControl>
                  <Input placeholder="New York" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-2">
            <FormLabel>Salary Range</FormLabel>
            <div className="flex items-center space-x-2">
              <FormField
                control={form.control}
                name="salary_min"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Min"
                        defaultValue={50000}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="salary_max"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Max"
                        defaultValue={100000}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Select onValueChange={field.onChange} defaultValue="USD">
                        <SelectTrigger>
                          <SelectValue placeholder="Currency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="GBP">GBP</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <FormField
            control={form.control}
            name="agreement_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Agreement</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an agreement" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {agreements.map((agreement) => (
                      <SelectItem key={agreement.id} value={agreement.id}>
                        {agreement.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="hiring_team"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hiring Team</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  multiple
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select members" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {members?.map((member) => (
                      <SelectItem key={member.id} value={member.user_email || member.invited_email || ''}>
                        {`${member.user_first_name || ''} ${member.user_last_name || ''}`.trim() || member.user_email || member.invited_email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="is_urgent"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-0.5 leading-none">
                  <FormLabel>Urgent</FormLabel>
                  <FormDescription>
                    Mark this job as urgent to prioritize it.
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Job Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Write a detailed job description"
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Additional notes or comments"
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div>
          <FormLabel>Agreement Content</FormLabel>
          <Card className="border-none shadow-none">
            <CardContent>
              <div className="border rounded-md bg-muted/50">
                {editor && (
                  <>
                    <BubbleMenu editor={editor}>
                      <div className="flex space-x-2 bg-white rounded p-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => editor.chain().focus().toggleBold().run()}
                          className={cn(
                            editor.isActive('bold') ? 'bg-accent' : '',
                            'h-7 px-2'
                          )}
                        >
                          Bold
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => editor.chain().focus().toggleItalic().run()}
                          className={cn(
                            editor.isActive('italic') ? 'bg-accent' : '',
                            'h-7 px-2'
                          )}
                        >
                          Italic
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => editor.chain().focus().toggleUnderline().run()}
                          className={cn(
                            editor.isActive('underline') ? 'bg-accent' : '',
                            'h-7 px-2'
                          )}
                        >
                          Underline
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => editor.chain().focus().unsetLink().run()}
                          className="h-7 px-2"
                        >
                          Unlink
                        </Button>
                      </div>
                    </BubbleMenu>
                    <FloatingMenu editor={editor}>
                      <div className="flex space-x-2 bg-white rounded p-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => editor.chain().focus().toggleBold().run()}
                          className={cn(
                            editor.isActive('bold') ? 'bg-accent' : '',
                            'h-7 px-2'
                          )}
                        >
                          Bold
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => editor.chain().focus().toggleItalic().run()}
                          className={cn(
                            editor.isActive('italic') ? 'bg-accent' : '',
                            'h-7 px-2'
                          )}
                        >
                          Italic
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => editor.chain().focus().toggleUnderline().run()}
                          className={cn(
                            editor.isActive('underline') ? 'bg-accent' : '',
                            'h-7 px-2'
                          )}
                        >
                          Underline
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => editor.chain().focus().unsetLink().run()}
                          className="h-7 px-2"
                        >
                          Unlink
                        </Button>
                      </div>
                    </FloatingMenu>
                    <EditorContent editor={editor} className="p-4" />
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="ghost" type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Submitting...' : 'Submit'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}
