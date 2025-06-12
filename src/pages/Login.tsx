
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { VirgilioLogo } from '@/components/VirgilioLogo'
import { CreateDevAdmin } from '@/components/dev/CreateDevAdmin'
import { useAuth } from '@/contexts/AuthContext'

export default function Login() {
  const { login, isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const { error } = await login(email, password)
      if (error) {
        setError(error.message)
      } else {
        navigate('/dashboard')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-accent/20 to-warning/10 flex items-center justify-center">
        <div className="text-center space-y-token-md">
          <div className="h-8 w-8 rounded-full bg-primary animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-accent/20 to-warning/10">
      <div className="grid lg:grid-cols-2 min-h-screen">
        {/* Left Side - Login Form */}
        <div className="flex flex-col justify-center px-8 lg:px-16 xl:px-24">
          {/* Logo */}
          <div className="mb-12">
            <VirgilioLogo size="lg" />
          </div>

          {/* Welcome Text */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-2">
              Bienvenido de vuelta
            </h1>
            <p className="text-lg text-muted-foreground">
              Inicia sesión en tu cuenta para continuar
            </p>
          </div>

          {/* Login Form */}
          <Card className="border-0 shadow-none bg-transparent p-0">
            <CardContent className="p-0">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-base font-medium">
                    Correo electrónico
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Ingresa tu correo electrónico"
                    required
                    disabled={isSubmitting}
                    className="h-12 text-base"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-base font-medium">
                    Contraseña
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ingresa tu contraseña"
                    required
                    disabled={isSubmitting}
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
                  disabled={isSubmitting}
                  size="lg"
                >
                  {isSubmitting ? 'Iniciando sesión...' : 'Iniciar sesión'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Development Setup */}
          <div className="mt-12 pt-8 border-t border-border/20">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Configuración de desarrollo
              </h3>
              <p className="text-sm text-muted-foreground">
                Configuración rápida para pruebas y desarrollo
              </p>
            </div>
            <CreateDevAdmin />
          </div>
        </div>

        {/* Right Side - Decorative Content */}
        <div className="hidden lg:flex flex-col items-center justify-center bg-gradient-to-br from-primary/5 to-accent/10 relative overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-20 left-20 w-32 h-32 rounded-full bg-primary"></div>
            <div className="absolute top-40 right-32 w-24 h-24 rounded-full bg-accent"></div>
            <div className="absolute bottom-32 left-32 w-40 h-40 rounded-full bg-warning"></div>
            <div className="absolute bottom-20 right-20 w-28 h-28 rounded-full bg-success"></div>
          </div>

          {/* Main Content */}
          <div className="relative z-10 text-center max-w-md px-8">
            <div className="mb-8">
              <div className="w-24 h-24 bg-gradient-to-br from-primary to-accent rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-xl">
                <div className="text-4xl">🚀</div>
              </div>
              <h2 className="text-3xl font-bold text-foreground mb-4">
                Conecta talento con oportunidad
              </h2>
              <p className="text-lg text-muted-foreground">
                Virgilio.io te ayuda a encontrar y gestionar el mejor talento para tu organización
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-surface-primary/80 backdrop-blur-sm rounded-lg p-4 border border-border/20">
                <div className="text-2xl mb-2">📊</div>
                <div className="font-medium text-foreground">Analytics</div>
                <div className="text-muted-foreground">Insights detallados</div>
              </div>
              <div className="bg-surface-primary/80 backdrop-blur-sm rounded-lg p-4 border border-border/20">
                <div className="text-2xl mb-2">🔒</div>
                <div className="font-medium text-foreground">Seguridad</div>
                <div className="text-muted-foreground">Datos protegidos</div>
              </div>
              <div className="bg-surface-primary/80 backdrop-blur-sm rounded-lg p-4 border border-border/20">
                <div className="text-2xl mb-2">⚡</div>
                <div className="font-medium text-foreground">Velocidad</div>
                <div className="text-muted-foreground">Procesos ágiles</div>
              </div>
              <div className="bg-surface-primary/80 backdrop-blur-sm rounded-lg p-4 border border-border/20">
                <div className="text-2xl mb-2">🎯</div>
                <div className="font-medium text-foreground">Precisión</div>
                <div className="text-muted-foreground">Matches perfectos</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
