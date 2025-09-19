import { useState, useEffect } from 'react'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { CalendarIcon, Loader2, Trash2 } from 'lucide-react'

interface Application {
  id: string
  jobId: string
  userId: string
  status: 'applied' | 'viewed' | 'interviewing' | 'offered' | 'rejected'
  matchScore?: number
  appliedDate?: string
  interviewDate?: string
  notes?: string
  job?: {
    id: string
    title: string
    company: string
    location: string
    type: string
    salary?: string
  }
}

// Schema for editing application
const editApplicationSchema = z.object({
  status: z.enum(['applied', 'viewed', 'interviewing', 'offered', 'rejected']),
  matchScore: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  interviewDate: z.date().optional(),
})

type EditApplicationData = z.infer<typeof editApplicationSchema>

interface EditApplicationModalProps {
  application: Application | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function EditApplicationModal({ application, isOpen, onOpenChange }: EditApplicationModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const form = useForm<EditApplicationData>({
    resolver: zodResolver(editApplicationSchema),
    defaultValues: {
      status: 'applied',
      matchScore: 50,
      notes: '',
    },
  })

  // Update form when application changes
  useEffect(() => {
    if (application) {
      form.reset({
        status: application.status || 'applied',
        matchScore: application.matchScore || 50,
        notes: application.notes || '',
        interviewDate: application.interviewDate ? new Date(application.interviewDate) : undefined,
      })
    }
  }, [application, form])

  const updateApplicationMutation = useMutation({
    mutationFn: async (data: EditApplicationData) => {
      if (!application) throw new Error('No application selected')

      const updateData = {
        ...data,
        interviewDate: data.interviewDate?.toISOString(),
      }

      const response = await apiRequest('PUT', `/api/applications/${application.id}`, updateData)

      if (!response.ok) {
        throw new Error('Failed to update application')
      }

      return await response.json()
    },
    onSuccess: () => {
      // Invalidate all relevant cache keys since updating an application affects multiple data sets
      queryClient.invalidateQueries({ queryKey: ['/api/applications'] })
      queryClient.invalidateQueries({ queryKey: ['/api/jobs/matched'] })
      toast({
        title: 'Application Updated',
        description: 'Your application has been successfully updated.',
      })
      onOpenChange(false)
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update application. Please try again.',
        variant: 'destructive',
      })
    },
    onSettled: () => {
      setIsSubmitting(false)
    },
  })

  const deleteApplicationMutation = useMutation({
    mutationFn: async () => {
      if (!application) throw new Error('No application selected')

      const response = await apiRequest('DELETE', `/api/applications/${application.id}`)

      if (!response.ok) {
        throw new Error('Failed to delete application')
      }

      return true
    },
    onSuccess: () => {
      // Invalidate all relevant cache keys since deleting an application affects multiple data sets
      queryClient.invalidateQueries({ queryKey: ['/api/applications'] })
      queryClient.invalidateQueries({ queryKey: ['/api/jobs/matched'] })
      toast({
        title: 'Application Deleted',
        description: 'The application has been successfully removed.',
      })
      onOpenChange(false)
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete application. Please try again.',
        variant: 'destructive',
      })
    },
  })

  const onSubmit = async (data: EditApplicationData) => {
    setIsSubmitting(true)
    updateApplicationMutation.mutate(data)
  }

  const handleDelete = () => {
    deleteApplicationMutation.mutate()
  }

  if (!application) return null

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Application</DialogTitle>
          <DialogDescription>
            Update the status and details for {application.job?.title} at {application.job?.company}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Job Info Display */}
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium text-foreground mb-2">{application.job?.title}</h4>
              <p className="text-sm text-muted-foreground">{application.job?.company}</p>
              <p className="text-sm text-muted-foreground">{application.job?.location}</p>
              {application.job?.salary && (
                <p className="text-sm text-muted-foreground">{application.job.salary}</p>
              )}
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Application Status *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
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
                        disabled={(date) => date < new Date('2020-01-01')}
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
                      rows={4}
                      {...field}
                      data-testid="textarea-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-between pt-4">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={isSubmitting || deleteApplicationMutation.isPending}
                    data-testid="button-delete-application"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the application for {application.job?.title} at {application.job?.company}. 
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete Application
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <div className="flex gap-2">
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
                  data-testid="button-update-application"
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update Application
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}