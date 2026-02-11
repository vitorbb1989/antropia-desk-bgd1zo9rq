import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Loader2 } from 'lucide-react'
import { useIntegrationStore } from '@/stores/useIntegrationStore'
import { IntegrationConfig } from '@/types'

interface ConfigModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData?: IntegrationConfig
}

export function ChatwootConfigModal({
  open,
  onOpenChange,
  initialData,
}: ConfigModalProps) {
  const { saveIntegration, testConnection } = useIntegrationStore()
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)

  const [formData, setFormData] = useState({
    baseUrl: initialData?.settings.baseUrl || '',
    apiAccessToken: initialData?.settings.apiAccessToken || '',
    accountId: initialData?.settings.accountId || '',
    isEnabled: initialData?.isEnabled || false,
  })

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleTest = async () => {
    setTesting(true)
    await testConnection('CHATWOOT', formData)
    setTesting(false)
  }

  const handleSave = async () => {
    setLoading(true)
    await saveIntegration({
      provider: 'CHATWOOT',
      settings: formData,
      isEnabled: formData.isEnabled,
    })
    setLoading(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Configurar Chatwoot</DialogTitle>
          <DialogDescription>
            Integre conversas do Chatwoot como tickets.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label>Ativar Integração</Label>
              <div className="text-xs text-muted-foreground">
                Sincronização bidirecional
              </div>
            </div>
            <Switch
              checked={formData.isEnabled}
              onCheckedChange={(c) => handleChange('isEnabled', c)}
            />
          </div>

          <div className="space-y-2">
            <Label>Installation URL</Label>
            <Input
              placeholder="https://chat.domain.com"
              value={formData.baseUrl}
              onChange={(e) => handleChange('baseUrl', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>API Access Token</Label>
            <Input
              type="password"
              value={formData.apiAccessToken}
              onChange={(e) => handleChange('apiAccessToken', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Account ID</Label>
            <Input
              value={formData.accountId}
              onChange={(e) => handleChange('accountId', e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleTest}
            disabled={testing || loading}
            className="w-full sm:w-auto"
          >
            {testing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              'Testar Conexão'
            )}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              'Salvar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
