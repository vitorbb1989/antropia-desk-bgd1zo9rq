import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Monitor, Activity, Filter, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function MonitoringDocs() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="rounded-full">
          <Link to="/admin/settings">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Status Page & Monitoramento
          </h1>
          <p className="text-muted-foreground">
            Guia de uso da Central de Operações.
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5 text-primary" /> Visão Geral
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed">
            <p>
              A <strong>Status Page</strong> é um painel dedicado para
              administradores que necessitam de uma visão macro da operação de
              suporte. Projetada para ser exibida em grandes monitores (TVs) em
              salas de operações, ela oferece alto contraste e atualização
              automática.
            </p>
            <p>
              Para acessar, navegue até o menu lateral e clique em{' '}
              <strong>Status Page</strong> (disponível apenas para ADMIN).
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" /> Atualização em Tempo
              Real
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed">
            <p>
              O dashboard utiliza <strong>Supabase Realtime</strong> para
              escutar mudanças no banco de dados instantaneamente.
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>
                <strong>Novos Chamados:</strong> Aparecem automaticamente no
                topo da lista.
              </li>
              <li>
                <strong>Mudança de Status:</strong> Cards são atualizados e
                reordenados sem refresh.
              </li>
              <li>
                <strong>Métricas (KPIs):</strong> Contadores são recalculados a
                cada evento recebido.
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-blue-500" /> Filtros Disponíveis
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Por Período</h4>
              <p className="text-xs text-muted-foreground">
                Filtre tickets criados Hoje, nos Últimos 7 dias ou 30 dias. Isso
                ajuda a focar na carga de trabalho recente.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Por Status</h4>
              <p className="text-xs text-muted-foreground">
                Isole tickets que requerem atenção (ex: "Aguardando Aprovação")
                ou veja apenas o backlog ativo.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Por Prioridade</h4>
              <p className="text-xs text-muted-foreground">
                Destaque rapidamente tickets URGENTES ou de ALTA prioridade.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
