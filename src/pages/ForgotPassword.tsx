
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { GoGioLogo } from '@/components/GoGioLogo'
import { supabase } from '@/lib/supabaseClient'
import { ArrowLeft, CheckCircle } from 'lucide-react'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const { error } = await supabase.functions.invoke('request-password-reset', {
        body: { email }
      })

      if (error) {
        setError(error.message)
      } else {
        setIsSuccess(true)
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex flex-col lg:flex-row">
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-transparent">
          <div className="mx-auto max-w-7xl px-layout-sm sm:px-layout-md lg:px-layout-lg">
            <div className="flex items-center justify-between h-14 sm:h-16">
              <div className="flex items-center">
                <div className="hover:scale-105 transition-transform duration-default">
                  <GoGioLogo size="sm" />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Success Content */}
        <div className="w-full bg-white flex flex-col justify-center items-center px-6 sm:px-8 min-h-screen">
          <div className="max-w-md w-full text-center">
            <div className="mb-8">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
                Check your email
              </h1>
              <p className="text-base text-muted-foreground">
                We've sent a password reset link to <strong>{email}</strong>
              </p>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Didn't receive the email? Check your spam folder or try again.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsSuccess(false)
                    setEmail('')
                  }}
                  className="flex-1"
                >
                  Try different email
                </Button>
                <Link to="/auth" className="flex-1">
                  <Button variant="default" className="w-full">
                    Back to login
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-transparent">
        <div className="mx-auto max-w-7xl px-layout-sm sm:px-layout-md lg:px-layout-lg">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center">
              <div className="hover:scale-105 transition-transform duration-default">
                <GoGioLogo size="sm" />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Left Side - Same yellow background as login */}
      <div className="w-full lg:w-2/3 xl:w-3/5 2xl:w-2/3 relative overflow-hidden flex items-center justify-center min-h-[50vh] lg:min-h-screen" style={{ backgroundColor: '#fffead' }}>
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Forgot your password?
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground">
            No worries, we'll send you reset instructions.
          </p>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/3 xl:w-2/5 2xl:w-1/3 bg-white flex flex-col justify-center px-6 sm:px-8 lg:px-8 xl:px-12 min-h-[50vh] lg:min-h-screen">
        {/* Back Link */}
        <div className="mb-8">
          <Link to="/auth" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to login
          </Link>
        </div>

        {/* Form */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Reset password
          </h1>
          <p className="text-base text-muted-foreground">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        <Card className="border-0 shadow-none bg-transparent p-0">
          <CardContent className="p-0">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-base font-medium">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  disabled={isLoading}
                  className="h-12 text-base"
                />
              </div>

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 text-base font-medium"
                disabled={isLoading}
                size="lg"
              >
                {isLoading ? 'Sending...' : 'Send reset instructions'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
