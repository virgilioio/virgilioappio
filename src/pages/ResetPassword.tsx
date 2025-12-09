
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { GoGioLogo } from '@/components/GoGioLogo'
import { supabase } from '@/lib/supabaseClient'
import { CheckCircle, Eye, EyeOff } from 'lucide-react'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [token, setToken] = useState('')

  useEffect(() => {
    const tokenParam = searchParams.get('token')
    if (!tokenParam) {
      setError('Invalid or missing reset token. Please request a new password reset.')
    } else {
      setToken(tokenParam)
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!token) {
      setError('Invalid reset token. Please request a new password reset.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long')
      return
    }

    setIsLoading(true)

    try {
      const { error } = await supabase.functions.invoke('reset-password', {
        body: {
          token,
          newPassword: password
        }
      })

      if (error) {
        setError(error.message)
      } else {
        setIsSuccess(true)
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/auth')
        }, 3000)
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
                Password updated!
              </h1>
              <p className="text-base text-muted-foreground">
                Your password has been successfully updated. You'll be redirected to the login page shortly.
              </p>
            </div>

            <Button
              onClick={() => navigate('/auth')}
              className="w-full"
            >
              Continue to login
            </Button>
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

      {/* Left Side - Same yellow background */}
      <div className="w-full lg:w-2/3 xl:w-3/5 2xl:w-2/3 relative overflow-hidden flex items-center justify-center min-h-[50vh] lg:min-h-screen" style={{ backgroundColor: '#fffead' }}>
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Set new password
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground">
            Choose a strong password for your account.
          </p>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/3 xl:w-2/5 2xl:w-1/3 bg-white flex flex-col justify-center px-6 sm:px-8 lg:px-8 xl:px-12 min-h-[50vh] lg:min-h-screen">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Create new password
          </h1>
          <p className="text-base text-muted-foreground">
            Enter your new password below.
          </p>
        </div>

        <Card className="border-0 shadow-none bg-transparent p-0">
          <CardContent className="p-0">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-base font-medium">
                  New Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new password"
                    required
                    disabled={isLoading}
                    className="h-12 text-base pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-base font-medium">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    required
                    disabled={isLoading}
                    className="h-12 text-base pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 text-base font-medium"
                disabled={isLoading || !password || !confirmPassword || !token}
                size="lg"
              >
                {isLoading ? 'Updating...' : 'Update password'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
