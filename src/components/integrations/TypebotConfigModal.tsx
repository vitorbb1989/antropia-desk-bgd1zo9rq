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

export function TypebotConfigModal({
  open,
  onOpenChange,
  initialData,
}: ConfigModalProps) {
  const { saveIntegration, testConnection } = useIntegrationStore()
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)

  const [formData, setFormData] = useState({
    apiToken: initialData?.settings.apiToken || '',
    workspaceId: initialData?.settings.workspaceId || '',
    defaultBotId: initialData?.settings.defaultBotId || '',
    isEnabled: initialData?.isEnabled || false,
  })

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleTest = async () => {
    setTesting(true)
    await testConnection('TYPEBOT', formData)
    setTesting(false)
  }

  const handleSave = async () => {
    setLoading(true)
    await saveIntegration({
      provider: 'TYPEBOT',
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
          <DialogTitle>Configurar Typebot</DialogTitle>
          <DialogDescription>
            Automatize conversas e crie tickets via bot.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label>Ativar Integração</Label>
              <div className="text-xs text-muted-foreground">
                Permitir disparos via API
              </div>
            </div>
            <Switch
              checked={formData.isEnabled}
              onCheckedChange={(c) => handleChange('isEnabled', c)}
            />
          </div>

          <div className="space-y-2">
            <Label>API Token</Label>
            <Input
              type="password"
              value={formData.apiToken}
              onChange={(e) => handleChange('apiToken', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Workspace ID</Label>
              <Input
                value={formData.workspaceId}
                onChange={(e) => handleChange('workspaceId', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Default Bot ID</Label>
              <Input
                value={formData.defaultBotId}
                onChange={(e) => handleChange('defaultBotId', e.target.value)}
              />
            </div>
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
