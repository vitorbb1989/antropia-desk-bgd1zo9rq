import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useWorkflowStore } from '@/stores/useWorkflowStore'
import { Workflow, WorkflowTriggerType, WorkflowActionType, NotificationTemplate } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Plus, Trash2, Save, PlayCircle } from 'lucide-react'
import { templateService } from '@/services/templateService'
import useAuthStore from '@/stores/useAuthStore'

export default function WorkflowEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { workflows, saveWorkflow } = useWorkflowStore()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [notifTemplates, setNotifTemplates] = useState<NotificationTemplate[]>([])

  const isNew = id === 'new' || !id
  const existing = workflows.find((w) => w.id === id)

  const [name, setName] = useState('')
  const [trigger, setTrigger] = useState<WorkflowTriggerType>('TICKET_CREATED')
  const [conditions, setConditions] = useState<
    { field: string; operator: 'EQUALS' | 'NOT_EQUALS'; value: string }[]
  >([])
  const [actions, setActions] = useState<
    { type: WorkflowActionType; config: any }[]
  >([])

  useEffect(() => {
    if (existing) {
      setName(existing.name)
      setTrigger(existing.triggerType)
      setConditions(existing.conditions)
      setActions(existing.actions)
    }
  }, [existing])

  // Load notification templates for SEND_NOTIFICATION action
  useEffect(() => {
    async function loadTemplates() {
      if (!user) return
      try {
        const templates = await templateService.getTemplates(user.companyId)
        setNotifTemplates(templates)
      } catch (e) {
        console.error('Failed to load notification templates', e)
      }
    }
    loadTemplates()
  }, [user])

  const handleSave = async () => {
    setLoading(true)
    await saveWorkflow({
      id: isNew ? undefined : id,
      name,
      triggerType: trigger,
      conditions,
      actions,
      isActive: true,
    })
    setLoading(false)
    navigate('/admin/workflows')
  }

  const addCondition = () => {
    setConditions([
      ...conditions,
      { field: 'priority', operator: 'EQUALS', value: 'HIGH' },
    ])
  }

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index))
  }

  const addAction = (type: WorkflowActionType) => {
    let config: any = {}
    if (type === 'TRIGGER_INTEGRATION') config = { provider: 'PLANKA' }
    if (type === 'ADD_TAG') config = { tag: '' }
    if (type === 'PLANKA_CREATE_SUBTASK')
      config = { taskName: 'Checklist Item' }
    if (type === 'SEND_NOTIFICATION')
      config = { template_id: '', channel: 'EMAIL', recipient: 'REQUESTER' }

    setActions([...actions, { type, config }])
  }

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index))
  }

  const updateActionConfig = (index: number, key: string, value: string) => {
    const newActions = [...actions]
    newActions[index] = {
      ...newActions[index],
      config: { ...newActions[index].config, [key]: value },
    }
    setActions(newActions)
  }

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/admin/workflows')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">
            {isNew ? 'Novo Workflow' : 'Editar Workflow'}
          </h1>
        </div>
        <Button onClick={handleSave} disabled={loading} className="gap-2">
          <Save className="h-4 w-4" /> Salvar
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>1. Configuração Básica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Workflow</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Criar Card no Planka"
              />
            </div>
            <div className="space-y-2">
              <Label>Gatilho (Trigger)</Label>
              <Select value={trigger} onValueChange={(v: any) => setTrigger(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TICKET_CREATED">Ticket Criado</SelectItem>
                  <SelectItem value="STATUS_CHANGED">
                    Status Alterado
                  </SelectItem>
                  <SelectItem value="PRIORITY_UPDATED">
                    Prioridade Atualizada
                  </SelectItem>
                  <SelectItem value="TICKET_CUSTOMER_REPLY">
                    Resposta do Cliente
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>2. Condições (Opcional)</CardTitle>
            <Button size="sm" variant="outline" onClick={addCondition}>
              <Plus className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {conditions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhuma condição. O workflow rodará sempre que o gatilho
                ocorrer.
              </p>
            )}
            {conditions.map((cond, i) => (
              <div key={i} className="flex items-center gap-2">
                <Select
                  value={cond.field}
                  onValueChange={(v) => {
                    const newConds = [...conditions]
                    newConds[i].field = v
                    setConditions(newConds)
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="priority">Prioridade</SelectItem>
                    <SelectItem value="type">Tipo</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={cond.operator}
                  onValueChange={(v: any) => {
                    const newConds = [...conditions]
                    newConds[i].operator = v
                    setConditions(newConds)
                  }}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EQUALS">Igual a</SelectItem>
                    <SelectItem value="NOT_EQUALS">Diferente de</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  className="flex-1"
                  value={cond.value}
                  onChange={(e) => {
                    const newConds = [...conditions]
                    newConds[i].value = e.target.value
                    setConditions(newConds)
                  }}
                  placeholder="Valor"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => removeCondition(i)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>3. Ações</CardTitle>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => addAction('TRIGGER_INTEGRATION')}
              >
                + Integração
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => addAction('SEND_NOTIFICATION')}
              >
                + Notificação
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => addAction('ADD_TAG')}
              >
                + Tag
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {actions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Adicione pelo menos uma ação.
              </p>
            )}
            {actions.map((action, i) => (
              <div
                key={i}
                className="border p-4 rounded-lg bg-secondary/10 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium flex items-center gap-2">
                    <PlayCircle className="h-4 w-4" />
                    {action.type === 'TRIGGER_INTEGRATION' &&
                      'Disparar Integração'}
                    {action.type === 'SEND_NOTIFICATION' &&
                      'Enviar Notificação'}
                    {action.type === 'ADD_TAG' && 'Adicionar Tag'}
                    {action.type === 'PLANKA_CREATE_SUBTASK' &&
                      'Criar Subtarefa no Planka'}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive h-8 w-8"
                    onClick={() => removeAction(i)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {action.type === 'TRIGGER_INTEGRATION' && (
                  <div className="flex items-center gap-2">
                    <Label className="w-24">Provedor:</Label>
                    <Select
                      value={action.config.provider}
                      onValueChange={(v) => updateActionConfig(i, 'provider', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PLANKA">Planka</SelectItem>
                        <SelectItem value="BOOKSTACK">Bookstack</SelectItem>
                        <SelectItem value="KRAYIN">Krayin CRM</SelectItem>
                        <SelectItem value="CHATWOOT">Chatwoot</SelectItem>
                        <SelectItem value="TYPEBOT">Typebot</SelectItem>
                      </SelectContent>
                    </Select>
                    {action.config.provider === 'PLANKA' && (
                      <div className="ml-auto">
                        <Button
                          size="sm"
                          variant="link"
                          onClick={() => {
                            const newActions = [...actions]
                            newActions[i].type = 'PLANKA_CREATE_SUBTASK'
                            newActions[i].config = { taskName: 'Nova Tarefa' }
                            setActions(newActions)
                          }}
                        >
                          Mudar para Subtarefa
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Provider-specific override fields for TRIGGER_INTEGRATION */}
                {action.type === 'TRIGGER_INTEGRATION' && action.config.provider === 'PLANKA' && (
                  <div className="space-y-2 pt-2 border-t mt-2">
                    <p className="text-xs text-muted-foreground">Sobrescrever config padrao (opcional):</p>
                    <div className="flex items-center gap-2">
                      <Label className="w-24 text-xs">Board ID:</Label>
                      <Input
                        value={action.config.boardId || ''}
                        onChange={(e) => updateActionConfig(i, 'boardId', e.target.value)}
                        placeholder="Usar padrao da integracao"
                        className="text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="w-24 text-xs">List ID:</Label>
                      <Input
                        value={action.config.listId || ''}
                        onChange={(e) => updateActionConfig(i, 'listId', e.target.value)}
                        placeholder="Usar padrao da integracao"
                        className="text-xs"
                      />
                    </div>
                  </div>
                )}

                {action.type === 'TRIGGER_INTEGRATION' && action.config.provider === 'BOOKSTACK' && (
                  <div className="space-y-2 pt-2 border-t mt-2">
                    <p className="text-xs text-muted-foreground">Sobrescrever config padrao (opcional):</p>
                    <div className="flex items-center gap-2">
                      <Label className="w-24 text-xs">Book ID:</Label>
                      <Input
                        value={action.config.bookId || ''}
                        onChange={(e) => updateActionConfig(i, 'bookId', e.target.value)}
                        placeholder="Usar padrao da integracao"
                        className="text-xs"
                      />
                    </div>
                  </div>
                )}

                {action.type === 'TRIGGER_INTEGRATION' && action.config.provider === 'CHATWOOT' && (
                  <div className="space-y-2 pt-2 border-t mt-2">
                    <p className="text-xs text-muted-foreground">Sobrescrever config padrao (opcional):</p>
                    <div className="flex items-center gap-2">
                      <Label className="w-24 text-xs">Inbox ID:</Label>
                      <Input
                        value={action.config.inboxId || ''}
                        onChange={(e) => updateActionConfig(i, 'inboxId', e.target.value)}
                        placeholder="Usar padrao da integracao"
                        className="text-xs"
                      />
                    </div>
                  </div>
                )}

                {action.type === 'TRIGGER_INTEGRATION' && action.config.provider === 'TYPEBOT' && (
                  <div className="space-y-2 pt-2 border-t mt-2">
                    <p className="text-xs text-muted-foreground">Sobrescrever config padrao (opcional):</p>
                    <div className="flex items-center gap-2">
                      <Label className="w-24 text-xs">Bot ID:</Label>
                      <Input
                        value={action.config.botId || ''}
                        onChange={(e) => updateActionConfig(i, 'botId', e.target.value)}
                        placeholder="Usar padrao da integracao"
                        className="text-xs"
                      />
                    </div>
                  </div>
                )}

                {action.type === 'ADD_TAG' && (
                  <div className="flex items-center gap-2">
                    <Label className="w-24">Tag:</Label>
                    <Input
                      value={action.config.tag}
                      onChange={(e) => updateActionConfig(i, 'tag', e.target.value)}
                      placeholder="Ex: urgente, vip"
                    />
                  </div>
                )}

                {action.type === 'PLANKA_CREATE_SUBTASK' && (
                  <div className="flex items-center gap-2">
                    <Label className="w-32">Nome da Tarefa:</Label>
                    <Input
                      value={action.config.taskName}
                      onChange={(e) => updateActionConfig(i, 'taskName', e.target.value)}
                      placeholder="Ex: Verificar logs"
                    />
                  </div>
                )}

                {action.type === 'SEND_NOTIFICATION' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Label className="w-24">Template:</Label>
                      <Select
                        value={action.config.template_id || ''}
                        onValueChange={(v) => updateActionConfig(i, 'template_id', v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um template" />
                        </SelectTrigger>
                        <SelectContent>
                          {notifTemplates.map((tpl) => (
                            <SelectItem key={tpl.id} value={tpl.id}>
                              {tpl.name} ({tpl.eventType})
                            </SelectItem>
                          ))}
                          {notifTemplates.length === 0 && (
                            <SelectItem value="" disabled>
                              Nenhum template cadastrado
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="w-24">Canal:</Label>
                      <Select
                        value={action.config.channel || 'EMAIL'}
                        onValueChange={(v) => updateActionConfig(i, 'channel', v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EMAIL">E-mail</SelectItem>
                          <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="w-24">Para:</Label>
                      <Select
                        value={action.config.recipient || 'REQUESTER'}
                        onValueChange={(v) => updateActionConfig(i, 'recipient', v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="REQUESTER">Solicitante</SelectItem>
                          <SelectItem value="ASSIGNEE">Agente Atribuído</SelectItem>
                          <SelectItem value="BOTH">Ambos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {notifTemplates.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Crie templates em Configurações {'>'} Notificações {'>'} Modelos.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
