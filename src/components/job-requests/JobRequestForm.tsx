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
import { useToast } from '@/hooks/use-toast'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useCreateJobRequest, CreateJobRequestData } from '@/hooks/useJobRequests'

const formSchema = z.object({
  title: z.string().min(2, {
    message: 'Job title must be at least 2 characters.',
  }),
  description: z.string().min(10, {
    message: 'Job description must be at least 10 characters.',
  }),
  department: z.string().optional(),
  level: z.enum(['L1', 'L2', 'L3']).default('L1'),
  location: z.string().min(2, {
    message: 'Location must be at least 2 characters.',
  }),
  salary_min: z.number().optional(),
  salary_max: z.number().optional(),
  currency: z.string().optional(),
  agreement_id: z.string().optional(),
  notes: z.string().optional(),
})

interface JobRequestFormProps {
  onSubmit: (data: CreateJobRequestData) => Promise<void>
  onCancel: () => void
  isLoading: boolean
}

export function JobRequestForm({
  onSubmit,
  onCancel,
  isLoading,
}: JobRequestFormProps) {
  const { toast } = useToast()
  const { profile } = useUserProfile()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      department: '',
      level: 'L1',
      location: '',
      salary_min: 50000,
      salary_max: 100000,
      currency: 'USD',
      agreement_id: '',
      notes: '',
    },
  })

  const handleParsedSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!profile) {
      toast({
        title: 'Error',
        description: 'Could not submit job request. User profile not found.',
        variant: 'destructive',
      })
      return
    }

    const jobRequestData: CreateJobRequestData = {
      title: values.title,
      description: values.description,
      department: values.department,
      level: values.level,
      location: values.location,
      salary_min: Number(values.salary_min),
      salary_max: Number(values.salary_max),
      currency: values.currency,
      notes: values.notes,
    }

    await onSubmit(jobRequestData)
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
