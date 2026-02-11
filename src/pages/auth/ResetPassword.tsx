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
import { supabase } from '@/lib/supabase/client'
import { useNavigate, Link } from 'react-router-dom'
import { LifeBuoy, Loader2, AlertCircle, CheckCircle2, Link as LinkIcon } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import useSettingsStore from '@/stores/useSettingsStore'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [validToken, setValidToken] = useState<boolean | null>(null)
  const { settings } = useSettingsStore()
  const navigate = useNavigate()

  useEffect(() => {
    // Check if we have a valid recovery session from the URL hash token
    supabase.auth.getSession().then(({ data: { session } }) => {
      setValidToken(!!session)
    }).catch(() => {
      setValidToken(false)
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      await supabase.auth.signOut()
      setSuccess(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch {
      setError('Erro ao redefinir a senha. O link pode ter expirado. Solicite um novo.')
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
            Redefinir Senha
          </CardTitle>
          <CardDescription className="text-base">
            {success ? 'Senha alterada com sucesso!' : validToken === false ? 'Link inválido ou expirado' : 'Crie sua nova senha'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {validToken === null ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : validToken === false ? (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Este link de redefinição é inválido ou expirou. Solicite um novo link.
                </AlertDescription>
              </Alert>
              <Link to="/forgot-password">
                <Button className="w-full h-11 text-base" variant="outline">
                  Solicitar novo link
                </Button>
              </Link>
            </div>
          ) : success ? (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Sua senha foi redefinida com sucesso. Redirecionando para o login...
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="password">Nova Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Repita a nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
                Redefinir Senha
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
