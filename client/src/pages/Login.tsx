import { useState } from 'react'
import { useLocation, useRoute } from 'wouter'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/queryClient'
import { Loader2, Mail, Phone, Chrome } from 'lucide-react'

const emailLoginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

const emailSignupSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required').max(50, 'First name too long'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name too long'),
})

const phoneRequestSchema = z.object({
  phone: z.string().regex(/^[+]?[\d\s()-]+$/, 'Please enter a valid phone number'),
})

const phoneVerifySchema = z.object({
  code: z.string().length(6, 'Verification code must be 6 digits'),
})

type EmailLoginData = z.infer<typeof emailLoginSchema>
type EmailSignupData = z.infer<typeof emailSignupSchema>
type PhoneRequestData = z.infer<typeof phoneRequestSchema>
type PhoneVerifyData = z.infer<typeof phoneVerifySchema>

export default function Login() {
  const [, setLocation] = useLocation()
  const [match] = useRoute('/signup')
  const isSignup = Boolean(match)
  const [phoneStep, setPhoneStep] = useState<'request' | 'verify'>('request')
  const [phoneNumber, setPhoneNumber] = useState('')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const emailForm = useForm<EmailLoginData | EmailSignupData>({
    resolver: zodResolver(isSignup ? emailSignupSchema : emailLoginSchema),
    defaultValues: isSignup ? {
      email: '',
      password: '',
      firstName: '',
      lastName: '',
    } : {
      email: '',
      password: '',
    },
  })

  const phoneRequestForm = useForm<PhoneRequestData>({
    resolver: zodResolver(phoneRequestSchema),
    defaultValues: {
      phone: '',
    },
  })

  const phoneVerifyForm = useForm<PhoneVerifyData>({
    resolver: zodResolver(phoneVerifySchema),
    defaultValues: {
      code: '',
    },
  })

  const emailMutation = useMutation({
    mutationFn: (data: EmailLoginData | EmailSignupData) => 
      apiRequest('POST', isSignup ? '/api/auth/register' : '/api/auth/login', data),
    onSuccess: () => {
      toast({
        title: 'Success!',
        description: isSignup ? 'Account created successfully' : 'Welcome back!',
      })
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] })
      setLocation('/dashboard')
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || `Failed to ${isSignup ? 'create account' : 'login'}`,
        variant: 'destructive',
      })
    },
  })

  const phoneRequestMutation = useMutation({
    mutationFn: (data: PhoneRequestData) => 
      apiRequest('POST', '/api/auth/phone/request', data),
    onSuccess: () => {
      setPhoneNumber(phoneRequestForm.getValues().phone)
      setPhoneStep('verify')
      toast({
        title: 'Code sent!',
        description: 'Please check your phone for the verification code',
      })
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to send verification code',
        variant: 'destructive',
      })
    },
  })

  const phoneVerifyMutation = useMutation({
    mutationFn: (data: PhoneVerifyData) => 
      apiRequest('POST', '/api/auth/phone/verify', { ...data, phone: phoneNumber }),
    onSuccess: () => {
      toast({
        title: 'Success!',
        description: 'Phone verified successfully',
      })
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] })
      setLocation('/dashboard')
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'Invalid verification code',
        variant: 'destructive',
      })
    },
  })

  const handleGoogleLogin = () => {
    window.location.href = '/api/auth/google'
  }

  const onEmailSubmit = (data: EmailLoginData | EmailSignupData) => {
    emailMutation.mutate(data)
  }

  const onPhoneRequestSubmit = (data: PhoneRequestData) => {
    phoneRequestMutation.mutate(data)
  }

  const onPhoneVerifySubmit = (data: PhoneVerifyData) => {
    phoneVerifyMutation.mutate(data)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            {isSignup ? 'Create Account' : 'Welcome Back'}
          </CardTitle>
          <CardDescription>
            {isSignup 
              ? 'Choose your preferred method to create an account'
              : 'Choose your preferred method to sign in'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="email" className="space-y-4">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="email" data-testid="tab-email">
                <Mail className="w-4 h-4 mr-2" />
                Email
              </TabsTrigger>
              <TabsTrigger value="phone" data-testid="tab-phone">
                <Phone className="w-4 h-4 mr-2" />
                Phone
              </TabsTrigger>
              <TabsTrigger value="google" data-testid="tab-google">
                <Chrome className="w-4 h-4 mr-2" />
                Google
              </TabsTrigger>
            </TabsList>

            <TabsContent value="email">
              <Form {...emailForm}>
                <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
                  <FormField
                    control={emailForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input 
                            type="email" 
                            placeholder="Enter your email" 
                            data-testid="input-email"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {isSignup && (
                    <>
                      <FormField
                        control={emailForm.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                              <Input 
                                type="text" 
                                placeholder="Enter your first name"
                                data-testid="input-firstName"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={emailForm.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input 
                                type="text" 
                                placeholder="Enter your last name"
                                data-testid="input-lastName"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                  <FormField
                    control={emailForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input 
                            type="password" 
                            placeholder="Enter your password"
                            data-testid="input-password"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={emailMutation.isPending}
                    data-testid="button-email-submit"
                  >
                    {emailMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {isSignup ? 'Create Account' : 'Sign In'}
                  </Button>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="phone">
              {phoneStep === 'request' ? (
                <Form {...phoneRequestForm}>
                  <form onSubmit={phoneRequestForm.handleSubmit(onPhoneRequestSubmit)} className="space-y-4">
                    <FormField
                      control={phoneRequestForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <Input 
                              type="tel" 
                              placeholder="+1 (555) 123-4567" 
                              data-testid="input-phone"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={phoneRequestMutation.isPending}
                      data-testid="button-phone-request"
                    >
                      {phoneRequestMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Send Verification Code
                    </Button>
                  </form>
                </Form>
              ) : (
                <Form {...phoneVerifyForm}>
                  <form onSubmit={phoneVerifyForm.handleSubmit(onPhoneVerifySubmit)} className="space-y-4">
                    <div className="text-sm text-muted-foreground text-center mb-4">
                      Verification code sent to {phoneNumber}
                    </div>
                    <FormField
                      control={phoneVerifyForm.control}
                      name="code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Verification Code</FormLabel>
                          <FormControl>
                            <Input 
                              type="text" 
                              placeholder="123456" 
                              maxLength={6}
                              data-testid="input-otp-code"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={phoneVerifyMutation.isPending}
                      data-testid="button-phone-verify"
                    >
                      {phoneVerifyMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Verify & Sign In
                    </Button>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      className="w-full" 
                      onClick={() => {
                        setPhoneStep('request')
                        phoneVerifyForm.reset()
                      }}
                      data-testid="button-phone-back"
                    >
                      ← Back to phone number
                    </Button>
                  </form>
                </Form>
              )}
            </TabsContent>

            <TabsContent value="google">
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  Sign in with your Google account
                </p>
                <Button 
                  onClick={handleGoogleLogin}
                  className="w-full" 
                  variant="outline"
                  data-testid="button-google-login"
                >
                  <Chrome className="w-4 h-4 mr-2" />
                  Continue with Google
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-6 text-center text-sm">
            {isSignup ? (
              <span>
                Already have an account?{' '}
                <button 
                  onClick={() => setLocation('/login')} 
                  className="text-primary hover:underline"
                  data-testid="link-to-login"
                >
                  Sign in
                </button>
              </span>
            ) : (
              <span>
                Don't have an account?{' '}
                <button 
                  onClick={() => setLocation('/signup')} 
                  className="text-primary hover:underline"
                  data-testid="link-to-signup"
                >
                  Create one
                </button>
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}