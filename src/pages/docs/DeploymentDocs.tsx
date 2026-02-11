import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  Terminal,
  Server,
  ShieldCheck,
  Activity,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function DeploymentDocs() {
  const navigate = useNavigate()

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-8">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/admin/settings')}
          className="rounded-full"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Guia de Implantação e Operação
          </h1>
          <p className="text-muted-foreground">
            Documentação técnica para produção, debugging e monitoramento.
          </p>
        </div>
      </div>

      <Tabs defaultValue="docker">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="docker">Docker & Swarm</TabsTrigger>
          <TabsTrigger value="traefik">Traefik & SSL</TabsTrigger>
          <TabsTrigger value="debugging">Debugging</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoramento</TabsTrigger>
        </TabsList>

        <TabsContent value="docker" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" /> Docker Compose (Desenvolvimento)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Para rodar o stack completo localmente.
              </p>
              <div className="bg-slate-950 text-slate-50 p-4 rounded-lg text-sm font-mono overflow-auto">
                {`version: "3.8"
services:
  web:
    build: .
    ports:
      - "3000:80"
    environment:
      - VITE_SUPABASE_URL=https://your-project.supabase.co
      - VITE_SUPABASE_PUBLISHABLE_KEY=your-key
  
  # Opcional: Evolution API para WhatsApp
  evolution:
    image: attrium/evolution-api:latest
    ports:
      - "8080:8080"
    environment:
      - AUTHENTICATION_API_KEY=global-key`}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5 text-blue-600" /> Docker Swarm
                (Produção)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Implantação escalável com Secrets e Replicas.
              </p>
              <ol className="list-decimal list-inside text-sm space-y-2 text-foreground/80">
                <li>
                  Inicie o Swarm: <code>docker swarm init</code>
                </li>
                <li>
                  Crie secrets:{' '}
                  <code>
                    echo "my-key" | docker secret create supabase_key -
                  </code>
                </li>
                <li>
                  Deploy da stack:{' '}
                  <code>
                    docker stack deploy -c docker-compose.prod.yml antropia
                  </code>
                </li>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="traefik" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-green-600" /> Reverse Proxy
                & SSL
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Configuração de labels para Traefik com Let's Encrypt
                automático.
              </p>
              <div className="bg-slate-950 text-slate-50 p-4 rounded-lg text-sm font-mono overflow-auto">
                {`deploy:
  labels:
    - "traefik.enable=true"
    - "traefik.http.routers.antropia.rule=Host(\`desk.antrop-ia.com\`)"
    - "traefik.http.routers.antropia.entrypoints=websecure"
    - "traefik.http.routers.antropia.tls.certresolver=myresolver"
    - "traefik.http.services.antropia.loadbalancer.server.port=80"`}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="debugging" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5 text-orange-600" /> Guia de
                Debugging
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <h3 className="font-semibold">1. Falha em Integrações</h3>
              <p className="text-muted-foreground">
                Acesse{' '}
                <strong>
                  Configurações &gt; Integrações &gt; Monitoramento
                </strong>
                . Verifique o status dos logs. Se o status for{' '}
                <code>FAILED</code>, clique no ícone de código para ver o JSON
                de erro retornado pela API externa.
              </p>
              <ul className="list-disc list-inside pl-4 text-muted-foreground">
                <li>
                  <strong>401 Unauthorized:</strong> Verifique se o Token/API
                  Key está correto.
                </li>
                <li>
                  <strong>404 Not Found:</strong> Verifique se a URL da API ou
                  IDs (Board, Project) estão corretos.
                </li>
                <li>
                  <strong>Timeout:</strong> O serviço externo pode estar
                  indisponível.
                </li>
              </ul>

              <h3 className="font-semibold mt-4">2. Workflows não disparam</h3>
              <p className="text-muted-foreground">
                Verifique se o trigger correto foi selecionado. Para "Resposta
                do Cliente", o remetente da mensagem deve ser igual ao{' '}
                <code>requester_id</code> do ticket.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-purple-600" /> Health Checks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                O sistema expõe métricas de saúde básicas. Para monitoramento
                avançado, recomenda-se conectar ferramentas como Prometheus ou
                visualizar os logs do Supabase.
              </p>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="border p-3 rounded-lg">
                  <div className="font-medium">Integration Logs</div>
                  <div className="text-xs text-muted-foreground">
                    Tabela: <code>integration_logs</code>
                  </div>
                </div>
                <div className="border p-3 rounded-lg">
                  <div className="font-medium">Notification Outbox</div>
                  <div className="text-xs text-muted-foreground">
                    Tabela: <code>notifications</code>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
