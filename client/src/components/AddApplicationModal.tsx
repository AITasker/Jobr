import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/queryClient'
import { useToast } from '@/hooks/use-toast'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { CalendarIcon, Loader2 } from 'lucide-react'

// Schema for manual application creation
const manualApplicationSchema = z.object({
  jobTitle: z.string().min(1, 'Job title is required'),
  company: z.string().min(1, 'Company name is required'),
  location: z.string().min(1, 'Location is required'),
  jobType: z.string().min(1, 'Job type is required'),
  salary: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['applied', 'viewed', 'interviewing', 'offered', 'rejected']),
  appliedDate: z.date({
    required_error: 'Applied date is required',
  }),
  matchScore: z.number().min(0).max(100).default(50),
  notes: z.string().optional(),
  interviewDate: z.date().optional(),
})

type ManualApplicationData = z.infer<typeof manualApplicationSchema>

interface AddApplicationModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function AddApplicationModal({ isOpen, onOpenChange }: AddApplicationModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const form = useForm<ManualApplicationData>({
    resolver: zodResolver(manualApplicationSchema),
    defaultValues: {
      jobTitle: '',
      company: '',
      location: '',
      jobType: 'Full-time',
      salary: '',
      description: '',
      status: 'applied',
      appliedDate: new Date(),
      matchScore: 50,
      notes: '',
    },
  })

  const createApplicationMutation = useMutation({
    mutationFn: async (data: ManualApplicationData) => {
      // First create the job entry
      const jobResponse = await apiRequest('POST', '/api/jobs', {
        title: data.jobTitle,
        company: data.company,
        location: data.location,
        type: data.jobType,
        salary: data.salary || '',
        description: data.description || `Manual entry for ${data.jobTitle} at ${data.company}`,
        requirements: [],
        isActive: false, // Mark as inactive since it's a manual entry
      })

      if (!jobResponse.ok) {
        throw new Error('Failed to create job entry')
      }

      const job = await jobResponse.json()

      // Then create the application
      const applicationResponse = await apiRequest('POST', '/api/applications', {
        jobId: job.id,
        status: data.status,
        matchScore: data.matchScore,
        appliedDate: data.appliedDate.toISOString(),
        interviewDate: data.interviewDate?.toISOString(),
        notes: data.notes,
        emailOpened: false,
      })

      if (!applicationResponse.ok) {
        throw new Error('Failed to create application')
      }

      return await applicationResponse.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/applications'] })
      toast({
        title: 'Application Added',
        description: 'Your application has been successfully added to the tracker.',
      })
      form.reset()
      onOpenChange(false)
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add application. Please try again.',
        variant: 'destructive',
      })
    },
    onSettled: () => {
      setIsSubmitting(false)
    },
  })

  const onSubmit = async (data: ManualApplicationData) => {
    setIsSubmitting(true)
    createApplicationMutation.mutate(data)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Manual Application</DialogTitle>
          <DialogDescription>
            Add an application you submitted outside of Career Co-Pilot to track its progress.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="jobTitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Job Title *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g. Senior Frontend Developer" 
                      {...field}
                      data-testid="input-job-title"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="company"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g. TechCorp Solutions" 
                      {...field}
                      data-testid="input-company"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g. San Francisco, CA" 
                        {...field}
                        data-testid="input-location"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="jobType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Type *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-job-type">
                          <SelectValue placeholder="Select job type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Full-time">Full-time</SelectItem>
                        <SelectItem value="Part-time">Part-time</SelectItem>
                        <SelectItem value="Contract">Contract</SelectItem>
                        <SelectItem value="Freelance">Freelance</SelectItem>
                        <SelectItem value="Internship">Internship</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="salary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Salary (Optional)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g. $80,000 - $120,000" 
                      {...field}
                      data-testid="input-salary"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Job Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Brief description of the role..."
                      className="resize-none"
                      rows={3}
                      {...field}
                      data-testid="textarea-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Status *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="applied">Applied</SelectItem>
                        <SelectItem value="viewed">Under Review</SelectItem>
                        <SelectItem value="interviewing">Interview</SelectItem>
                        <SelectItem value="offered">Offered</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="matchScore"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Match Score (0-100)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        min="0"
                        max="100"
                        placeholder="50"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-match-score"
                      />
                    </FormControl>
                    <FormDescription>
                      How well does this role match your skills and experience?
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="appliedDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Applied Date *</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={'outline'}
                          className={cn(
                            'w-full pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                          data-testid="button-applied-date"
                        >
                          {field.value ? (
                            format(field.value, 'PPP')
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date > new Date() || date < new Date('1900-01-01')
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="interviewDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Interview Date (Optional)</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={'outline'}
                          className={cn(
                            'w-full pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                          data-testid="button-interview-date"
                        >
                          {field.value ? (
                            format(field.value, 'PPP')
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Any additional notes about this application..."
                      className="resize-none"
                      rows={3}
                      {...field}
                      data-testid="textarea-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                data-testid="button-add-application"
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Application
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}