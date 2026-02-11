import useAuthStore from '@/stores/useAuthStore'
import useTicketStore from '@/stores/useTicketStore'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  UserPlus,
  Inbox,
  LayoutDashboard,
  FileBarChart,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { translateStatus } from '@/utils/translations'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useEffect, useState } from 'react'
import { ticketService } from '@/services/ticketService'
import { TicketStatusChart } from '@/components/dashboard/TicketStatusChart'
import { TicketPriorityChart } from '@/components/dashboard/TicketPriorityChart'
import { TicketTrendsChart } from '@/components/dashboard/TicketTrendsChart'
import { AgentPerformanceChart } from '@/components/dashboard/AgentPerformanceChart'
import { CategoryDistributionChart } from '@/components/dashboard/CategoryDistributionChart'
import { DashboardMetrics } from '@/components/dashboard/DashboardMetrics'
import { Skeleton } from '@/components/ui/skeleton'
import { useDashboardStore } from '@/stores/useDashboardStore'
import { DashboardCustomizer } from '@/components/dashboard/DashboardCustomizer'

export default function Index() {
  const { user } = useAuthStore()
  const { tickets, assignTicket } = useTicketStore()
  const { toast } = useToast()
  const [stats, setStats] = useState<any>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const {
    isWidgetVisible,
    setCustomizing,
    loading: loadingPrefs,
  } = useDashboardStore()

  useEffect(() => {
    if (user && (user.role === 'ADMIN' || user.role === 'AGENT')) {
      setLoadingStats(true)
      ticketService
        .getAdvancedStats(user.companyId)
        .then(setStats)
        .catch(console.error)
        .finally(() => setLoadingStats(false))
    }
  }, [user])

  if (!user) return null

  // Enhanced filtering logic to include unassigned tickets for Agents
  const myTickets = tickets.filter((t) => {
    if (user.role === 'USER') return t.requesterId === user.id
    if (user.role === 'AGENT') return t.assigneeId === user.id || !t.assigneeId
    return true
  })

  // Priority Flow Sorting Logic
  const priorityWeight: Record<string, number> = {
    URGENT: 3,
    HIGH: 2,
    MEDIUM: 1,
    LOW: 0,
  }

  const priorityTickets = myTickets
    .filter((t) => t.status !== 'CLOSED')
    .sort((a, b) => {
      const prioA = priorityWeight[a.priority] ?? 0
      const prioB = priorityWeight[b.priority] ?? 0
      if (prioA !== prioB) return prioB - prioA
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })
    .slice(0, 5)

  const handleAssignToMe = (ticketId: string, readableId: string) => {
    assignTicket(ticketId, user.id)
    toast({
      title: 'Ticket Atribuído',
      description: `Você assumiu o ticket ${readableId}`,
    })
  }

  // User/Client View - Minimalist (No customization for users in this story context, or simple)
  if (user.role === 'USER') {
    return (
      <div className="max-w-4xl mx-auto space-y-12 py-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-semibold tracking-tight">
            Como podemos ajudar hoje?
          </h1>
          <p className="text-muted-foreground text-lg max-w-lg mx-auto">
            Pesquise em nossa base de conhecimento ou crie um chamado para obter
            suporte de nossa equipe.
          </p>
          <div className="pt-4 flex justify-center gap-4">
            <Button
              size="lg"
              className="rounded-full shadow-lg h-14 px-8"
              asChild
            >
              <Link to="/tickets/new">Abrir Novo Chamado</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-full h-14 px-8 bg-white/50"
              asChild
            >
              <Link to="/tickets">Acompanhar Meus Chamados</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="hover:scale-[1.01] transition-transform">
            <CardHeader>
              <CardTitle>Solicitações Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {myTickets.slice(0, 3).map((ticket) => (
                  <div
                    key={ticket.id}
                    className="flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          'h-2 w-2 rounded-full',
                          ticket.status === 'CLOSED'
                            ? 'bg-muted-foreground'
                            : 'bg-green-500',
                        )}
                      />
                      <div>
                        <div className="font-medium group-hover:text-primary transition-colors">
                          {ticket.title}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {ticket.readableId}
                        </div>
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-secondary/50">
                      {translateStatus(ticket.status)}
                    </Badge>
                  </div>
                ))}
                {myTickets.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma solicitação ativa
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-white border-0">
            <CardHeader>
              <CardTitle className="text-blue-900">Você sabia?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-blue-800/80 leading-relaxed">
                Você pode encontrar respostas para perguntas comuns em nossa
                seção de FAQ. Atualizamos semanalmente com novos guias de
                solução de problemas.
              </p>
              <Button
                variant="link"
                className="p-0 mt-4 text-blue-600 h-auto font-medium"
              >
                Navegar no FAQ <ArrowRight className="ml-1 w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Agent/Admin View - Advanced Analytics with Customization
  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <DashboardCustomizer />
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight mb-1">
            Painel Analytics
          </h1>
          <p className="text-muted-foreground">
            Visão geral da operação de suporte.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground font-medium bg-white px-3 py-1 rounded-full shadow-sm hidden sm:block">
            {new Date().toLocaleDateString('pt-BR', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCustomizing(true)}
            className="gap-2"
          >
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Personalizar</span>
          </Button>
        </div>
      </div>

      {loadingStats || loadingPrefs ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {isWidgetVisible('metrics_cards') && (
            <DashboardMetrics stats={stats} />
          )}

          {/* Visual Charts */}
          {stats && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {isWidgetVisible('chart_trends') && (
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Tendência de Volume</CardTitle>
                    <CardDescription>
                      Criados vs Resolvidos (30 dias)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <TicketTrendsChart data={stats.trends} />
                  </CardContent>
                </Card>
              )}
              {isWidgetVisible('chart_category') && (
                <Card>
                  <CardHeader>
                    <CardTitle>Por Categoria</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CategoryDistributionChart data={stats.byCategory} />
                  </CardContent>
                </Card>
              )}

              {isWidgetVisible('chart_status') && (
                <Card>
                  <CardHeader>
                    <CardTitle>Por Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TicketStatusChart data={stats.byStatus} />
                  </CardContent>
                </Card>
              )}
              {isWidgetVisible('chart_agents') && (
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Performance por Agente</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <AgentPerformanceChart data={stats.agentPerformance} />
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Queue */}
          <div className="grid gap-6 md:grid-cols-3">
            {isWidgetVisible('queue_priority') && (
              <Card className="col-span-2">
                <CardHeader>
                  <CardTitle>Fluxo Prioritário (Minha Fila)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {priorityTickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        className="flex items-center justify-between py-4 border-b border-border/40 last:border-0 hover:bg-muted/30 px-2 -mx-2 rounded-lg transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={cn(
                              'w-1 h-10 rounded-full',
                              ticket.priority === 'URGENT'
                                ? 'bg-red-500'
                                : ticket.priority === 'HIGH'
                                  ? 'bg-orange-500'
                                  : 'bg-slate-200',
                            )}
                          />
                          <div className="grid gap-1">
                            <div className="font-medium text-sm flex items-center gap-2">
                              <span className="font-mono text-xs text-muted-foreground">
                                {ticket.readableId}
                              </span>
                              {ticket.title}
                            </div>
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              {ticket.description}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!ticket.assigneeId && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 gap-1.5 text-primary hover:text-primary hover:bg-primary/10 mr-2"
                              onClick={() =>
                                handleAssignToMe(ticket.id, ticket.readableId)
                              }
                            >
                              <UserPlus className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline text-xs font-medium">
                                Atribuir a Mim
                              </span>
                            </Button>
                          )}
                          <Badge
                            variant={
                              ticket.priority === 'URGENT'
                                ? 'destructive'
                                : 'secondary'
                            }
                          >
                            {translateStatus(ticket.status)}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            asChild
                          >
                            <Link to={`/tickets/${ticket.id}`}>
                              <ArrowRight className="h-4 w-4 opacity-50" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                    {priorityTickets.length === 0 && (
                      <div className="py-12 text-center text-muted-foreground">
                        Tudo limpo!
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Ações Rápidas</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <Button
                  className="w-full justify-start h-12 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary shadow-none border-0"
                  variant="outline"
                  asChild
                >
                  <Link to="/tickets">
                    <Inbox className="mr-2 h-4 w-4" /> Ir para a Fila
                  </Link>
                </Button>
                <Button
                  className="w-full justify-start h-12"
                  variant="ghost"
                  asChild
                >
                  <Link to="/reports">
                    <FileBarChart className="mr-2 h-4 w-4" /> Relatórios
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start h-12"
                  asChild
                >
                  <Link to="/admin/settings">
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Configurações
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
