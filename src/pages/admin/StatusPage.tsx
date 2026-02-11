import {
  StatusPageProvider,
  useStatusPageStore,
} from '@/stores/useStatusPageStore'
import { StatusKPIs } from '@/components/status/StatusKPIs'
import { StatusCard } from '@/components/status/StatusCard'
import { StatusFilters } from '@/components/status/StatusFilters'
import { Skeleton } from '@/components/ui/skeleton'
import useAuthStore from '@/stores/useAuthStore'
import { Navigate } from 'react-router-dom'
import { Monitor, Download, Printer } from 'lucide-react'
import { DashboardAlertSettings } from '@/components/status/DashboardAlertSettings'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TicketStatusChart } from '@/components/dashboard/TicketStatusChart'
import { TicketPriorityChart } from '@/components/dashboard/TicketPriorityChart'
import { OrganizationDistributionChart } from '@/components/dashboard/OrganizationDistributionChart'
import { TicketTrendsChart } from '@/components/dashboard/TicketTrendsChart'

function StatusPageContent() {
  const { tickets, loading, chartsData, exportData } = useStatusPageStore()

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8 print:p-0 print:bg-white">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Monitor className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                Central de Operações
              </h1>
              <p className="text-muted-foreground">
                Monitoramento de chamados em tempo real.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <DashboardAlertSettings />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Download className="h-4 w-4" /> Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => exportData('csv')}>
                  Exportar CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportData('pdf')}>
                  <Printer className="mr-2 h-4 w-4" /> Imprimir / PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Print Header */}
        <div className="hidden print:block mb-8">
          <h1 className="text-2xl font-bold">Relatório de Operações</h1>
          <p className="text-sm text-gray-500">
            Gerado em {new Date().toLocaleString()}
          </p>
        </div>

        <StatusKPIs />

        <div className="print:hidden">
          <StatusFilters />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="col-span-1 md:col-span-2 lg:col-span-2 print:break-inside-avoid">
            <CardHeader>
              <CardTitle>Tendência de Volume</CardTitle>
            </CardHeader>
            <CardContent>
              <TicketTrendsChart data={chartsData.trends} />
            </CardContent>
          </Card>
          <Card className="print:break-inside-avoid">
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <TicketStatusChart data={chartsData.status} />
            </CardContent>
          </Card>
          <Card className="print:break-inside-avoid">
            <CardHeader>
              <CardTitle>Prioridade</CardTitle>
            </CardHeader>
            <CardContent>
              <TicketPriorityChart data={chartsData.priority} />
            </CardContent>
          </Card>
          <Card className="print:break-inside-avoid">
            <CardHeader>
              <CardTitle>Organizações</CardTitle>
            </CardHeader>
            <CardContent>
              <OrganizationDistributionChart data={chartsData.organization} />
            </CardContent>
          </Card>
        </div>

        {/* Ticket Grid */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight print:hidden">
            Chamados Recentes ({tickets.length})
          </h2>
          {loading && tickets.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in duration-500 print:grid-cols-2">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="print:break-inside-avoid">
                  <StatusCard ticket={ticket} />
                </div>
              ))}
              {tickets.length === 0 && (
                <div className="col-span-full h-64 flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-xl">
                  Nenhum chamado encontrado com os filtros atuais.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function StatusPage() {
  const { user } = useAuthStore()

  if (!user || user.role !== 'ADMIN') {
    return <Navigate to="/" />
  }

  return (
    <StatusPageProvider>
      <StatusPageContent />
    </StatusPageProvider>
  )
}
