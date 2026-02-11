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
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { useIntegrationStore } from '@/stores/useIntegrationStore'
import { IntegrationConfig } from '@/types'

interface PlankaConfigModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData?: IntegrationConfig
}

export function PlankaConfigModal({
  open,
  onOpenChange,
  initialData,
}: PlankaConfigModalProps) {
  const { saveIntegration, testConnection } = useIntegrationStore()
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)

  const [formData, setFormData] = useState({
    apiUrl: initialData?.settings.apiUrl || '',
    apiToken: initialData?.settings.apiToken || '',
    projectId: initialData?.settings.projectId || '',
    boardId: initialData?.settings.boardId || '',
    listId: initialData?.settings.listId || '',
    isEnabled: initialData?.isEnabled || false,
  })

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleTest = async () => {
    setTesting(true)
    await testConnection('PLANKA', formData)
    setTesting(false)
  }

  const handleSave = async () => {
    setLoading(true)
    await saveIntegration({
      provider: 'PLANKA',
      settings: {
        apiUrl: formData.apiUrl,
        apiToken: formData.apiToken,
        projectId: formData.projectId,
        boardId: formData.boardId,
        listId: formData.listId,
      },
      isEnabled: formData.isEnabled,
    })
    setLoading(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Configurar Planka</DialogTitle>
          <DialogDescription>
            Conecte seu quadro Kanban do Planka para criar cards
            automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label>Ativar Integração</Label>
              <div className="text-xs text-muted-foreground">
                Habilitar sincronização
              </div>
            </div>
            <Switch
              checked={formData.isEnabled}
              onCheckedChange={(c) => handleChange('isEnabled', c)}
            />
          </div>

          <div className="space-y-2">
            <Label>API URL</Label>
            <Input
              placeholder="https://planka.domain.com/api"
              value={formData.apiUrl}
              onChange={(e) => handleChange('apiUrl', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>API Token</Label>
            <Input
              type="password"
              placeholder="Token de acesso"
              value={formData.apiToken}
              onChange={(e) => handleChange('apiToken', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-2">
              <Label>Project ID</Label>
              <Input
                value={formData.projectId}
                onChange={(e) => handleChange('projectId', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Board ID</Label>
              <Input
                value={formData.boardId}
                onChange={(e) => handleChange('boardId', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>List ID</Label>
              <Input
                value={formData.listId}
                onChange={(e) => handleChange('listId', e.target.value)}
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
