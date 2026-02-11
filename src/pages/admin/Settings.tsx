import { useNavigate } from 'react-router-dom'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Bell,
  User,
  Building,
  Shield,
  FileText,
  Database,
  Workflow,
  LayoutGrid,
  Book,
  Server,
  Monitor,
  MessageSquare,
  Activity,
  Tag,
} from 'lucide-react'
import { BrandingSettingsForm } from '@/components/settings/BrandingSettings'
import { NotificationChannels } from '@/components/settings/NotificationChannels'
import { NotificationTemplates } from '@/components/settings/NotificationTemplates'
import { NotificationLogs } from '@/components/settings/NotificationLogs'
import { SystemDocumentation } from '@/components/settings/SystemDocumentation'
import { CategoriesSettings } from '@/components/settings/CategoriesSettings'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function Settings() {
  const navigate = useNavigate()

  return (
    <div className="max-w-6xl mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie o sistema, notificações e aparência.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
        <Card
          className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500"
          onClick={() => navigate('/settings/profile')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5" /> Meu Perfil
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Senha, avatar e informações pessoais.
            </p>
          </CardContent>
        </Card>

        <Card
          className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-green-500"
          onClick={() => navigate('/settings/notifications')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="h-5 w-5" /> Notificações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Canais, horários e eventos.
            </p>
          </CardContent>
        </Card>

        <Card
          className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-purple-500"
          onClick={() => navigate('/admin/workflows')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Workflow className="h-5 w-5" /> Automações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Crie regras e workflows automáticos.
            </p>
          </CardContent>
        </Card>

        <Card
          className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-orange-500"
          onClick={() => navigate('/admin/integrations')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <LayoutGrid className="h-5 w-5" /> Integrações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Conecte com Planka, Jira, CRM, etc.
            </p>
          </CardContent>
        </Card>

        <Card
          className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-yellow-500"
          onClick={() => navigate('/docs/monitoring')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Monitor className="h-5 w-5" /> Status Page
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Guia da Central de Operações.
            </p>
          </CardContent>
        </Card>

        <Card
          className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-gray-500"
          onClick={() => navigate('/docs/notifications')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" /> Docs Notificações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Guia de canais e templates.
            </p>
          </CardContent>
        </Card>

        <Card
          className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-slate-700"
          onClick={() => navigate('/docs/deployment')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Server className="h-5 w-5" /> Docs Implantação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Docker, Swarm e Debugging.
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="categories" className="space-y-6">
        <TabsList>
          <TabsTrigger value="categories" className="gap-2">
            <Tag className="h-4 w-4" /> Categorias
          </TabsTrigger>
          <TabsTrigger value="channels" className="gap-2">
            <MessageSquare className="h-4 w-4" /> Canais
          </TabsTrigger>
          <TabsTrigger value="branding" className="gap-2">
            <Building className="h-4 w-4" /> Identidade Visual
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <Bell className="h-4 w-4" /> Modelos de Mensagem
          </TabsTrigger>
          <TabsTrigger value="monitor" className="gap-2">
            <Activity className="h-4 w-4" /> Monitor
          </TabsTrigger>
          <TabsTrigger value="system" className="gap-2">
            <Database className="h-4 w-4" /> Sistema & Integrações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categories">
          <CategoriesSettings />
        </TabsContent>

        <TabsContent value="channels">
          <NotificationChannels />
        </TabsContent>

        <TabsContent value="branding">
          <BrandingSettingsForm />
        </TabsContent>

        <TabsContent value="templates">
          <NotificationTemplates />
        </TabsContent>

        <TabsContent value="monitor">
          <NotificationLogs />
        </TabsContent>

        <TabsContent value="system">
          <SystemDocumentation />
        </TabsContent>
      </Tabs>
    </div>
  )
}
