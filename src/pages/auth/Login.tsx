import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import useAuthStore from '@/stores/useAuthStore'
import useSettingsStore from '@/stores/useSettingsStore'
import { useNavigate, Link } from 'react-router-dom'
import { LifeBuoy, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login, isAuthenticated } = useAuthStore()
  const { settings } = useSettingsStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, navigate])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email) {
      setError('Por favor, insira um e-mail válido.')
      return
    }

    if (!password) {
      setError('Por favor, insira sua senha.')
      return
    }

    setLoading(true)
    try {
      await login(email, password)
      toast.success('Bem-vindo de volta!')
    } catch (err) {
      const msg = err instanceof Error && err.message.includes('organização')
        ? 'Usuário sem organização vinculada. Contate o administrador.'
        : 'Credenciais inválidas ou usuário inativo.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50 p-4">
      <Card className="w-full max-w-md shadow-lg border-0 bg-white">
        <CardHeader className="space-y-2 text-center pb-8">
          <div className="flex justify-center mb-4">
            {settings.branding.logoUrl ? (
              <img
                src={settings.branding.logoUrl}
                alt="Logo"
                className="h-14 object-contain"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <LifeBuoy className="h-6 w-6" />
              </div>
            )}
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Antropia Desk
          </CardTitle>
          <CardDescription className="text-base">
            Entre com seu e-mail e senha para acessar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail Corporativo</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu.nome@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                  Esqueceu a senha?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 text-base shadow-sm"
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Acessar Plataforma
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
