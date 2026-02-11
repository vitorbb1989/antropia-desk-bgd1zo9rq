import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  NotificationEventType,
  NotificationChannelType,
  NotificationTemplate,
} from '@/types'
import {
  Save,
  Mail,
  MessageSquare,
  Server,
  Layers,
  Trash2,
  Plus,
} from 'lucide-react'
import { toast } from 'sonner'
import { renderTemplate, getMockPayload } from '@/utils/templateUtils'
import { templateService } from '@/services/templateService'
import useAuthStore from '@/stores/useAuthStore'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const EVENT_LABELS: Record<string, string> = {
  TICKET_CREATED: 'Chamado Criado',
  TICKET_UPDATED: 'Chamado Atualizado',
  TICKET_ASSIGNED: 'Chamado Atribuído',
  TICKET_COMMENT: 'Novo Comentário',
  WAITING_APPROVAL: 'Aguardando Aprovação',
  APPROVAL_REMINDER_24H: 'Lembrete de Aprovação',
  TICKET_CLOSED: 'Chamado Fechado',
  SOLUTION_SENT: 'Solução Enviada',
  SLA_WARNING: 'Alerta de SLA',
  SLA_BREACH: 'SLA Violado',
  MENTION: 'Menção',
}

const CHANNEL_OPTIONS: {
  value: NotificationChannelType | 'DEFAULT'
  label: string
  icon: React.ReactNode
}[] = [
  {
    value: 'DEFAULT',
    label: 'Padrão (Fallback)',
    icon: <Layers className="h-4 w-4" />,
  },
  {
    value: 'WHATSAPP_CLOUD',
    label: 'WhatsApp Cloud',
    icon: <MessageSquare className="h-4 w-4" />,
  },
  {
    value: 'EVOLUTION',
    label: 'Evolution API',
    icon: <Server className="h-4 w-4" />,
  },
  { value: 'EMAIL', label: 'E-mail', icon: <Mail className="h-4 w-4" /> },
]

export function NotificationTemplates() {
  const { user } = useAuthStore()
  const [templates, setTemplates] = useState<NotificationTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Editor State
  const [eventType, setEventType] =
    useState<NotificationEventType>('TICKET_CREATED')
  const [channel, setChannel] = useState<NotificationChannelType | 'DEFAULT'>(
    'DEFAULT',
  )
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [header, setHeader] = useState('')
  const [footer, setFooter] = useState('')

  useEffect(() => {
    if (user) loadTemplates()
  }, [user])

  const loadTemplates = async () => {
    if (!user) return
    setLoading(true)
    try {
      const data = await templateService.getTemplates(user.companyId)
      setTemplates(data)
    } catch (e) {
      toast.error('Erro ao carregar modelos')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingId('new')
    setName('Novo Modelo')
    setEventType('TICKET_CREATED')
    setChannel('DEFAULT')
    setSubject('')
    setBody(
      'Olá {{actors.requester.name}}, seu chamado {{ticket.public_id}} foi atualizado.',
    )
    setHeader('')
    setFooter('')
  }

  const handleEdit = (tpl: NotificationTemplate) => {
    setEditingId(tpl.id)
    setName(tpl.name)
    setEventType(tpl.eventType)
    setChannel(tpl.channel)
    setSubject(tpl.subjectTemplate || '')
    setBody(tpl.bodyTemplate)
    setHeader(tpl.header || '')
    setFooter(tpl.footer || '')
  }

  const handleSave = async () => {
    if (!user) return
    try {
      if (editingId === 'new') {
        await templateService.createTemplate({
          organizationId: user.companyId,
          name,
          eventType,
          channel,
          subjectTemplate: subject,
          bodyTemplate: body,
          header,
          footer,
          enabled: true,
        })
        toast.success('Modelo criado')
      } else if (editingId) {
        await templateService.updateTemplate(editingId, {
          name,
          eventType,
          channel,
          subjectTemplate: subject,
          bodyTemplate: body,
          header,
          footer,
        })
        toast.success('Modelo atualizado')
      }
      setEditingId(null)
      loadTemplates()
    } catch (e) {
      toast.error('Erro ao salvar modelo')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza?')) return
    try {
      await templateService.deleteTemplate(id)
      toast.success('Modelo excluído')
      loadTemplates()
    } catch (e) {
      toast.error('Erro ao excluir')
    }
  }

  // Preview Logic
  const mockPayload = getMockPayload(eventType)
  const previewBody = renderTemplate(body, mockPayload)
  const previewHeader = renderTemplate(header, mockPayload)
  const previewFooter = renderTemplate(footer, mockPayload)

  if (editingId) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              {editingId === 'new' ? 'Novo Modelo' : 'Editar Modelo'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Modelo</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Evento</Label>
                <Select
                  value={eventType}
                  onValueChange={(v) =>
                    setEventType(v as NotificationEventType)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EVENT_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Canal</Label>
                <Select
                  value={channel}
                  onValueChange={(v) => setChannel(v as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNEL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {channel === 'EMAIL' && (
              <div className="space-y-2">
                <Label>Assunto</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
            )}

            <Tabs defaultValue="body" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="header">Cabeçalho</TabsTrigger>
                <TabsTrigger value="body">Corpo</TabsTrigger>
                <TabsTrigger value="footer">Rodapé</TabsTrigger>
              </TabsList>
              <TabsContent value="header" className="space-y-2">
                <Label>Texto do Cabeçalho</Label>
                <Textarea
                  value={header}
                  onChange={(e) => setHeader(e.target.value)}
                  className="h-20"
                  placeholder="Ex: Olá!"
                />
                <p className="text-xs text-muted-foreground">
                  Opcional. Aparece antes do corpo da mensagem.
                </p>
              </TabsContent>
              <TabsContent value="body" className="space-y-2">
                <Label>Conteúdo Principal</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="h-40 font-mono text-sm"
                />
                <div className="text-xs text-muted-foreground">
                  Variáveis disponíveis: <code>{'{{ticket.public_id}}'}</code>,{' '}
                  <code>{'{{ticket.title}}'}</code>,{' '}
                  <code>{'{{actors.requester.name}}'}</code>
                </div>
              </TabsContent>
              <TabsContent value="footer" className="space-y-2">
                <Label>Texto do Rodapé</Label>
                <Textarea
                  value={footer}
                  onChange={(e) => setFooter(e.target.value)}
                  className="h-20"
                  placeholder="Ex: Atenciosamente, Equipe de Suporte"
                />
                <p className="text-xs text-muted-foreground">
                  Opcional. Aparece após o corpo da mensagem.
                </p>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setEditingId(null)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                <Save className="mr-2 h-4 w-4" /> Salvar
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-secondary/10 border-0 h-fit sticky top-4">
          <CardHeader>
            <CardTitle>Pré-visualização</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-white rounded border shadow-sm overflow-hidden text-sm">
              {channel === 'EMAIL' && subject && (
                <div className="border-b px-4 py-2 bg-muted/50 font-medium">
                  Assunto: {renderTemplate(subject, mockPayload)}
                </div>
              )}
              <div className="p-4 space-y-4">
                {previewHeader && (
                  <div className="text-muted-foreground whitespace-pre-wrap">
                    {previewHeader}
                  </div>
                )}
                <div className="whitespace-pre-wrap">{previewBody}</div>
                {previewFooter && (
                  <div className="text-muted-foreground whitespace-pre-wrap border-t pt-4 text-xs">
                    {previewFooter}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="px-0 pt-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Gerenciador de Modelos</CardTitle>
            <CardDescription>
              Personalize as mensagens enviadas automaticamente.
            </CardDescription>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" /> Novo Modelo
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Evento</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell>
                  {EVENT_LABELS[t.eventType] || t.eventType}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {t.channel === 'EMAIL' && <Mail className="h-3 w-3" />}
                    {t.channel === 'WHATSAPP_CLOUD' && (
                      <MessageSquare className="h-3 w-3" />
                    )}
                    {t.channel === 'EVOLUTION' && (
                      <Server className="h-3 w-3" />
                    )}
                    {t.channel === 'DEFAULT' && <Layers className="h-3 w-3" />}
                    {t.channel}
                  </div>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(t)}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => handleDelete(t.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {templates.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center py-8 text-muted-foreground"
                >
                  Nenhum modelo encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
