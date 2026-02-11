import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useDashboardStore } from '@/stores/useDashboardStore'
import { LayoutDashboard } from 'lucide-react'

const WIDGET_LABELS: Record<string, string> = {
  metrics_cards: 'Métricas Principais (Cards)',
  chart_trends: 'Gráfico de Tendências',
  chart_category: 'Distribuição por Categoria',
  chart_status: 'Status dos Chamados',
  chart_agents: 'Performance da Equipe',
  queue_priority: 'Fila de Prioridades',
}

export function DashboardCustomizer() {
  const { isCustomizing, setCustomizing, isWidgetVisible, toggleWidget } =
    useDashboardStore()

  return (
    <Sheet open={isCustomizing} onOpenChange={setCustomizing}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5" /> Personalizar Dashboard
          </SheetTitle>
          <SheetDescription>
            Escolha quais informações você deseja ver no seu painel principal.
          </SheetDescription>
        </SheetHeader>
        <div className="py-6 space-y-6">
          {Object.entries(WIDGET_LABELS).map(([key, label]) => (
            <div
              key={key}
              className="flex items-center justify-between space-x-2"
            >
              <Label htmlFor={key} className="flex-1 cursor-pointer">
                {label}
              </Label>
              <Switch
                id={key}
                checked={isWidgetVisible(key)}
                onCheckedChange={() => toggleWidget(key)}
              />
            </div>
          ))}
        </div>
        <div className="pt-4 mt-4 border-t">
          <Button className="w-full" onClick={() => setCustomizing(false)}>
            Concluir
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
