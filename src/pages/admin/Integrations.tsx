import { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useIntegrationStore } from '@/stores/useIntegrationStore'
import { PlankaConfigModal } from '@/components/integrations/PlankaConfigModal'
import { BookstackConfigModal } from '@/components/integrations/BookstackConfigModal'
import { KrayinConfigModal } from '@/components/integrations/KrayinConfigModal'
import { ChatwootConfigModal } from '@/components/integrations/ChatwootConfigModal'
import { TypebotConfigModal } from '@/components/integrations/TypebotConfigModal'
import { IntegrationLogsViewer } from '@/components/integrations/IntegrationLogsViewer'
import { IntegrationDashboard } from '@/components/integrations/IntegrationDashboard'
import {
  LayoutGrid,
  Loader2,
  Book,
  Users,
  MessageSquare,
  Bot,
  Activity,
  BarChart3,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function Integrations() {
  const { integrations, fetchIntegrations, loading } = useIntegrationStore()
  const [plankaOpen, setPlankaOpen] = useState(false)
  const [bookstackOpen, setBookstackOpen] = useState(false)
  const [krayinOpen, setKrayinOpen] = useState(false)
  const [chatwootOpen, setChatwootOpen] = useState(false)
  const [typebotOpen, setTypebotOpen] = useState(false)

  useEffect(() => {
    fetchIntegrations()
  }, [fetchIntegrations])

  const getConfig = (provider: string) =>
    integrations.find((i) => i.provider === provider)

  const IntegrationCard = ({
    title,
    desc,
    icon: Icon,
    colorClass,
    provider,
    onOpen,
  }: any) => {
    const config = getConfig(provider)
    return (
      <Card className="flex flex-col hover:shadow-md transition-all">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className={`p-2 rounded-lg ${colorClass.bg}`}>
              <Icon className={`h-8 w-8 ${colorClass.text}`} />
            </div>
            {config?.isEnabled && <Badge variant="success">Ativo</Badge>}
          </div>
          <CardTitle className="mt-4">{title}</CardTitle>
          <CardDescription className="min-h-[40px]">{desc}</CardDescription>
        </CardHeader>
        <CardContent className="mt-auto pt-4">
          <Button
            variant={config?.isEnabled ? 'outline' : 'default'}
            className="w-full"
            onClick={onOpen}
          >
            {config ? 'Configurar' : 'Conectar'}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="max-w-6xl mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Integrações</h1>
        <p className="text-muted-foreground">
          Conecte o Antropia Desk a ferramentas externas.
        </p>
      </div>

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config" className="gap-2">
            <LayoutGrid className="h-4 w-4" /> Configuração
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="gap-2">
            <BarChart3 className="h-4 w-4" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="monitoring" className="gap-2">
            <Activity className="h-4 w-4" /> Monitoramento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-6 pt-6">
          {loading && integrations.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-48 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <IntegrationCard
                title="Planka"
                desc="Kanban open-source. Crie cards automaticamente."
                icon={LayoutGrid}
                colorClass={{ bg: 'bg-blue-50', text: 'text-blue-600' }}
                provider="PLANKA"
                onOpen={() => setPlankaOpen(true)}
              />
              <IntegrationCard
                title="Bookstack"
                desc="Sincronize sua base de conhecimento com documentação externa."
                icon={Book}
                colorClass={{ bg: 'bg-indigo-50', text: 'text-indigo-600' }}
                provider="BOOKSTACK"
                onOpen={() => setBookstackOpen(true)}
              />
              <IntegrationCard
                title="Krayin CRM"
                desc="Mantenha leads e contatos sincronizados com o suporte."
                icon={Users}
                colorClass={{ bg: 'bg-orange-50', text: 'text-orange-600' }}
                provider="KRAYIN"
                onOpen={() => setKrayinOpen(true)}
              />
              <IntegrationCard
                title="Chatwoot"
                desc="Centralize conversas multicanal no seu helpdesk."
                icon={MessageSquare}
                colorClass={{ bg: 'bg-green-50', text: 'text-green-600' }}
                provider="CHATWOOT"
                onOpen={() => setChatwootOpen(true)}
              />
              <IntegrationCard
                title="Typebot"
                desc="Crie tickets e capture dados via fluxos de chatbot."
                icon={Bot}
                colorClass={{ bg: 'bg-yellow-50', text: 'text-yellow-600' }}
                provider="TYPEBOT"
                onOpen={() => setTypebotOpen(true)}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="dashboard" className="pt-6">
          <IntegrationDashboard />
        </TabsContent>

        <TabsContent value="monitoring" className="pt-6">
          <IntegrationLogsViewer />
        </TabsContent>
      </Tabs>

      <PlankaConfigModal
        open={plankaOpen}
        onOpenChange={setPlankaOpen}
        initialData={getConfig('PLANKA')}
      />
      <BookstackConfigModal
        open={bookstackOpen}
        onOpenChange={setBookstackOpen}
        initialData={getConfig('BOOKSTACK')}
      />
      <KrayinConfigModal
        open={krayinOpen}
        onOpenChange={setKrayinOpen}
        initialData={getConfig('KRAYIN')}
      />
      <ChatwootConfigModal
        open={chatwootOpen}
        onOpenChange={setChatwootOpen}
        initialData={getConfig('CHATWOOT')}
      />
      <TypebotConfigModal
        open={typebotOpen}
        onOpenChange={setTypebotOpen}
        initialData={getConfig('TYPEBOT')}
      />
    </div>
  )
}
