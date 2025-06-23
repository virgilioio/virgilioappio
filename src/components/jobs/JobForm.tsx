
import { useState } from 'react'
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
import { Card, CardContent } from '@/components/ui/card'
import { FormDescription } from '@/components/ui/form'
import { useToast } from '@/hooks/use-toast'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useMembersWithProfiles } from '@/hooks/useMembersWithProfiles'

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
  hiring_team: z.array(z.string()).optional(),
  is_urgent: z.boolean().default(false),
  notes: z.string().optional(),
})

interface JobFormProps {
  onSubmit: (values: z.infer<typeof formSchema>) => Promise<void>
  onCancel: () => void
  isLoading: boolean
}

export function JobForm({
  onSubmit,
  onCancel,
  isLoading,
}: JobFormProps) {
  const { toast } = useToast()
  const { profile } = useUserProfile()
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
      hiring_team: [],
      is_urgent: false,
      notes: '',
    },
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

    await onSubmit({
      ...values,
      salary_min: Number(values.salary_min),
      salary_max: Number(values.salary_max),
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
                        value={field.value || ''}
                        onChange={(e) => field.onChange(Number(e.target.value))}
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
                        value={field.value || ''}
                        onChange={(e) => field.onChange(Number(e.target.value))}
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
            name="hiring_team"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hiring Team</FormLabel>
                <Select
                  onValueChange={(value) => {
                    const currentValues = Array.isArray(field.value) ? field.value : []
                    if (!currentValues.includes(value)) {
                      field.onChange([...currentValues, value])
                    }
                  }}
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
