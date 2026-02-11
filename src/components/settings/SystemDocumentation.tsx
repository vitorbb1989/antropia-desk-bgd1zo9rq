import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  GitCommit,
  Database,
  Map,
  MessageSquare,
  Server,
  Code,
  Layers,
  FileCode,
  Table as TableIcon,
} from 'lucide-react'

export function SystemDocumentation() {
  return (
    <Card className="border-0 shadow-none bg-transparent">
      <Tabs defaultValue="architecture" className="w-full">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Documentação do Sistema
            </h2>
            <p className="text-sm text-muted-foreground">
              Guias de configuração e referência técnica.
            </p>
          </div>
          <TabsList>
            <TabsTrigger value="architecture" className="gap-2">
              <Layers className="h-4 w-4" /> Arquitetura
            </TabsTrigger>
            <TabsTrigger value="erd" className="gap-2">
              <Database className="h-4 w-4" /> Schema (ERD)
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-2">
              <MessageSquare className="h-4 w-4" /> Integrações
            </TabsTrigger>
            <TabsTrigger value="api" className="gap-2">
              <FileCode className="h-4 w-4" /> API & Edge
            </TabsTrigger>
            <TabsTrigger value="changelog" className="gap-2">
              <GitCommit className="h-4 w-4" /> Change Log
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="architecture" className="space-y-4 animate-fade-in">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-blue-600" /> Frontend
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  Desenvolvido com <strong>React 19</strong>,{' '}
                  <strong>Vite</strong> e <strong>TypeScript</strong>.
                </p>
                <ul className="list-disc list-inside text-muted-foreground">
                  <li>
                    <strong>UI Library:</strong> Shadcn/ui + TailwindCSS.
                  </li>
                  <li>
                    <strong>State Management:</strong> Context API + Hooks
                    (Stores customizadas).
                  </li>
                  <li>
                    <strong>Routing:</strong> React Router v7.
                  </li>
                  <li>
                    <strong>Forms:</strong> React Hook Form + Zod validation.
                  </li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-green-600" /> Backend &
                  Database
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>Supabase (PostgreSQL) com Row Level Security (RLS).</p>
                <ul className="list-disc list-inside text-muted-foreground">
                  <li>
                    <strong>Auth:</strong> Supabase Auth (Email/Password).
                  </li>
                  <li>
                    <strong>Storage:</strong> Buckets para anexos e assets.
                  </li>
                  <li>
                    <strong>Realtime:</strong> Subscrições para atualizações de
                    tickets.
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="erd" className="space-y-4 animate-fade-in">
          <Card>
            <CardHeader>
              <CardTitle>Estrutura de Banco de Dados</CardTitle>
              <CardDescription>
                Principais tabelas e relacionamentos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <TableIcon className="h-4 w-4" /> tickets
                </div>
                <p className="text-sm text-muted-foreground pl-6">
                  Armazena os chamados. Relaciona-se com{' '}
                  <code>organizations</code>,{' '}
                  <code>users (requester, assignee)</code> e{' '}
                  <code>ticket_categories</code>. Contém métricas como{' '}
                  <code>estimated_cost</code> e <code>satisfaction_score</code>.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <TableIcon className="h-4 w-4" /> ticket_timeline
                </div>
                <p className="text-sm text-muted-foreground pl-6">
                  Histórico de mensagens e eventos. Relaciona-se com{' '}
                  <code>tickets</code>. Diferencia mensagens internas via flag{' '}
                  <code>is_internal</code>.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <TableIcon className="h-4 w-4" /> notifications
                </div>
                <p className="text-sm text-muted-foreground pl-6">
                  Fila de notificações (Outbox). Processada por Edge Functions
                  ou Webhooks. Contém <code>status</code> (PENDING, SENT) e{' '}
                  <code>channel</code>.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <TableIcon className="h-4 w-4" /> report_templates
                </div>
                <p className="text-sm text-muted-foreground pl-6">
                  Configurações para geração de relatórios recorrentes. Define
                  frequência, métricas e destinatários.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4 animate-fade-in">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-green-600" /> WhatsApp
                  Cloud API
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                  <li>
                    Acesse o{' '}
                    <a
                      href="https://developers.facebook.com/"
                      target="_blank"
                      className="text-primary hover:underline"
                    >
                      Meta for Developers
                    </a>{' '}
                    e crie um app do tipo "Business".
                  </li>
                  <li>Adicione o produto "WhatsApp" ao seu app.</li>
                  <li>
                    No painel esquerdo, vá em{' '}
                    <strong>WhatsApp &gt; API Setup</strong>.
                  </li>
                  <li>
                    Copie o <strong>Phone Number ID</strong> e o{' '}
                    <strong>WhatsApp Business Account ID (WABA ID)</strong>.
                  </li>
                  <li>Insira esses dados na aba "Canais" deste sistema.</li>
                </ol>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5 text-blue-600" /> Evolution API
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                  <li>Instale a Evolution API em seu servidor.</li>
                  <li>Crie uma nova instância e escaneie o QR Code.</li>
                  <li>
                    Obtenha a <strong>API Key Global</strong> e o{' '}
                    <strong>Instance Name</strong>.
                  </li>
                  <li>
                    Insira a URL completa (ex:{' '}
                    <code>https://api.desk.antrop-ia.com</code>) na aba "Canais".
                  </li>
                </ol>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="api" className="space-y-4 animate-fade-in">
          <Card>
            <CardHeader>
              <CardTitle>Edge Functions</CardTitle>
              <CardDescription>
                Funções serverless executadas na borda para tarefas pesadas ou
                agendadas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 border rounded bg-muted/20">
                    <div className="font-semibold text-sm mb-2">
                      generate-reports
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Trigger: Cron/Manual
                      <br />
                      Gera relatórios PDF/HTML baseados em templates e envia por
                      e-mail ou WhatsApp. Calcula métricas avançadas (CSAT,
                      Cost).
                    </p>
                  </div>
                  <div className="p-4 border rounded bg-muted/20">
                    <div className="font-semibold text-sm mb-2">
                      process-notifications
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Trigger: Database Webhook
                      <br />
                      Processa a fila da tabela <code>notifications</code>.
                      Conecta-se a provedores externos (SMTP, Meta API) para
                      envio real.
                    </p>
                  </div>
                  <div className="p-4 border rounded bg-muted/20">
                    <div className="font-semibold text-sm mb-2">check-sla</div>
                    <p className="text-xs text-muted-foreground">
                      Trigger: Cron (Hourly)
                      <br />
                      Monitora tickets abertos. Gera alertas{' '}
                      <code>SLA_WARNING</code> (2h antes) e{' '}
                      <code>SLA_BREACH</code> (vencidos).
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="changelog" className="space-y-4 animate-fade-in">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Atualizações</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-8 relative pl-4 border-l border-border/50 ml-2">
                  <div className="relative">
                    <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-primary border-2 border-background" />
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="default">v1.5.0</Badge>
                        <span className="text-sm text-muted-foreground">
                          Production Ready Release
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          Agora
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        - <strong>Performance:</strong> Índices de banco de
                        dados otimizados para consultas de alta escala.
                        <br />- <strong>SLA:</strong> Automação de alertas de
                        vencimento.
                        <br />- <strong>Métricas:</strong> Cálculo real de
                        Custo, CSAT e Tempo de Resolução.
                        <br />- <strong>Docs:</strong> Documentação técnica
                        expandida.
                      </p>
                    </div>
                  </div>
                  <div className="relative">
                    <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-muted border-2 border-background" />
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">v1.4.0</Badge>
                        <span className="text-sm text-muted-foreground">
                          Relatórios & Branding
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Adicionado suporte a branding personalizado em
                        relatórios e modelos de notificação.
                      </p>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Card>
  )
}
