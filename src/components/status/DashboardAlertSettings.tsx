import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
  Settings,
  Bell,
  Volume2,
  AlertTriangle,
  RefreshCcw,
} from 'lucide-react'
import { useStatusPageStore } from '@/stores/useStatusPageStore'
import { Checkbox } from '@/components/ui/checkbox'

export function DashboardAlertSettings() {
  const { alertConfig, setAlertConfig } = useStatusPageStore()

  const toggleTrigger = (trigger: string) => {
    const current = alertConfig.triggers
    const updated = current.includes(trigger)
      ? current.filter((t) => t !== trigger)
      : [...current, trigger]
    setAlertConfig({ ...alertConfig, triggers: updated })
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Alertas</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Configuração de Alertas do Painel</DialogTitle>
          <DialogDescription>
            Defina como você deseja ser notificado sobre eventos em tempo real
            nesta tela.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
              <Bell className="h-4 w-4" /> Tipos de Notificação
            </h4>
            <div className="flex items-center justify-between">
              <Label htmlFor="visual-alerts">Alertas Visuais (Pop-ups)</Label>
              <Switch
                id="visual-alerts"
                checked={alertConfig.visual}
                onCheckedChange={(c) =>
                  setAlertConfig({ ...alertConfig, visual: c })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="audio-alerts">Alertas Sonoros</Label>
              <Switch
                id="audio-alerts"
                checked={alertConfig.audio}
                onCheckedChange={(c) =>
                  setAlertConfig({ ...alertConfig, audio: c })
                }
              />
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Gatilhos
            </h4>
            <div className="flex items-center gap-2">
              <Checkbox
                id="trigger-urgent"
                checked={alertConfig.triggers.includes('URGENT')}
                onCheckedChange={() => toggleTrigger('URGENT')}
              />
              <Label htmlFor="trigger-urgent" className="font-normal">
                Novo Chamado URGENTE
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="trigger-status"
                checked={alertConfig.triggers.includes('STATUS_CHANGE')}
                onCheckedChange={() => toggleTrigger('STATUS_CHANGE')}
              />
              <Label htmlFor="trigger-status" className="font-normal">
                Mudança de Status
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="trigger-new"
                checked={alertConfig.triggers.includes('NEW_TICKET')}
                onCheckedChange={() => toggleTrigger('NEW_TICKET')}
              />
              <Label htmlFor="trigger-new" className="font-normal">
                Qualquer Novo Chamado
              </Label>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
