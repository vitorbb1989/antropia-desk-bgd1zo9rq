import { useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  MessageSquare,
  Mail,
  Server,
  Send,
  Lock,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import useSettingsStore from '@/stores/useSettingsStore'
import { toast } from 'sonner'
import { NotificationChannelType } from '@/types'

export function NotificationChannels() {
  const { settings, updateChannelConfig, testChannel, loading } =
    useSettingsStore()

  // Test Message State
  const [testRecipient, setTestRecipient] = useState('')
  const [testingChannel, setTestingChannel] =
    useState<NotificationChannelType | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<
    Record<string, 'success' | 'error' | null>
  >({})

  const getChannel = (type: NotificationChannelType) =>
    settings.notificationChannels.find((c) => c.type === type)

  const handleToggle = (type: NotificationChannelType, checked: boolean) => {
    updateChannelConfig(type, checked, {})
  }

  const handleConfigChange = (
    type: NotificationChannelType,
    key: string,
    value: string,
  ) => {
    updateChannelConfig(type, getChannel(type)?.enabled || false, {
      [key]: value,
    })
  }

  const handleSendTest = async (type: NotificationChannelType) => {
    if (!testRecipient) {
      toast.error('Informe um destinatário para o teste')
      return
    }
    setTestingChannel(type)
    setConnectionStatus((prev) => ({ ...prev, [type]: null }))

    try {
      await testChannel(type, testRecipient)
      setConnectionStatus((prev) => ({ ...prev, [type]: 'success' }))
    } catch (e) {
      setConnectionStatus((prev) => ({ ...prev, [type]: 'error' }))
    } finally {
      setTestingChannel(null)
    }
  }

  const ConnectionStatus = ({
    status,
  }: {
    status: 'success' | 'error' | null
  }) => {
    if (!status) return null
    return status === 'success' ? (
      <div className="flex items-center gap-1 text-xs text-green-600 font-medium mt-2 animate-fade-in">
        <CheckCircle2 className="h-3 w-3" /> Conexão Verificada
      </div>
    ) : (
      <div className="flex items-center gap-1 text-xs text-red-600 font-medium mt-2 animate-fade-in">
        <XCircle className="h-3 w-3" /> Falha na Conexão
      </div>
    )
  }

  const renderConfigInputs = (type: NotificationChannelType) => {
    const channel = getChannel(type)
    if (!channel) return null

    if (type === 'WHATSAPP_CLOUD') {
      return (
        <div className="grid gap-4 pt-4 border-t mt-4 animate-fade-in-down">
          <div className="grid gap-2">
            <Label>WABA ID</Label>
            <Input
              value={channel.config.wabaId || ''}
              onChange={(e) =>
                handleConfigChange(type, 'wabaId', e.target.value)
              }
              placeholder="Ex: 10593..."
            />
          </div>
          <div className="grid gap-2">
            <Label>Phone Number ID</Label>
            <Input
              value={channel.config.phoneNumberId || ''}
              onChange={(e) =>
                handleConfigChange(type, 'phoneNumberId', e.target.value)
              }
              placeholder="Ex: 10223..."
            />
          </div>
          <div className="grid gap-2">
            <Label>Access Token</Label>
            <div className="relative">
              <Input
                value={channel.config.apiKey || ''}
                onChange={(e) =>
                  handleConfigChange(type, 'apiKey', e.target.value)
                }
                placeholder="Ex: EAAG..."
                type="password"
                className="pr-10"
              />
              <Lock className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground opacity-50" />
            </div>
            <p className="text-[10px] text-muted-foreground">
              O token é armazenado de forma criptografada (Vault).
            </p>
          </div>
          <div className="bg-muted/50 p-3 rounded-md mt-2">
            <Label className="text-xs text-muted-foreground">URL do Webhook (registre na Meta)</Label>
            <div className="flex items-center gap-2 mt-1">
              <code className="text-xs bg-background px-2 py-1 rounded border flex-1 break-all">
                {`${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/whatsapp-webhook`}
              </code>
              <Button variant="ghost" size="sm" type="button" onClick={() => {
                navigator.clipboard.writeText(`${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/whatsapp-webhook`)
                toast.success('URL copiada!')
              }}>
                Copiar
              </Button>
            </div>
          </div>
        </div>
      )
    }

    if (type === 'EVOLUTION') {
      return (
        <div className="grid gap-4 pt-4 border-t mt-4 animate-fade-in-down">
          <div className="grid gap-2">
            <Label>Server URL</Label>
            <Input
              value={channel.config.serverUrl || ''}
              onChange={(e) =>
                handleConfigChange(type, 'serverUrl', e.target.value)
              }
              placeholder="Ex: https://api.evolution.com"
            />
          </div>
          <div className="grid gap-2">
            <Label>Instance Name</Label>
            <Input
              value={channel.config.instanceName || ''}
              onChange={(e) =>
                handleConfigChange(type, 'instanceName', e.target.value)
              }
              placeholder="Ex: my-instance"
            />
          </div>
          <div className="grid gap-2">
            <Label>Global API Key</Label>
            <div className="relative">
              <Input
                value={channel.config.apiKey || ''}
                onChange={(e) =>
                  handleConfigChange(type, 'apiKey', e.target.value)
                }
                placeholder="Ex: B6D7..."
                type="password"
                className="pr-10"
              />
              <Lock className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground opacity-50" />
            </div>
          </div>
          <div className="bg-muted/50 p-3 rounded-md mt-2">
            <Label className="text-xs text-muted-foreground">URL do Webhook (registre na Evolution)</Label>
            <div className="flex items-center gap-2 mt-1">
              <code className="text-xs bg-background px-2 py-1 rounded border flex-1 break-all">
                {`${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/evolution-webhook`}
              </code>
              <Button variant="ghost" size="sm" type="button" onClick={() => {
                navigator.clipboard.writeText(`${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/evolution-webhook`)
                toast.success('URL copiada!')
              }}>
                Copiar
              </Button>
            </div>
          </div>
        </div>
      )
    }

    if (type === 'EMAIL') {
      return (
        <div className="grid gap-4 pt-4 border-t mt-4 animate-fade-in-down">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>SMTP Host</Label>
              <Input
                value={channel.config.smtpHost || ''}
                onChange={(e) =>
                  handleConfigChange(type, 'smtpHost', e.target.value)
                }
                placeholder="smtp.example.com"
              />
            </div>
            <div className="grid gap-2">
              <Label>Port</Label>
              <Input
                value={channel.config.smtpPort || ''}
                onChange={(e) =>
                  handleConfigChange(type, 'smtpPort', e.target.value)
                }
                placeholder="587"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Sender Email</Label>
            <Input
              value={channel.config.senderEmail || ''}
              onChange={(e) =>
                handleConfigChange(type, 'senderEmail', e.target.value)
              }
              placeholder="support@company.com"
            />
          </div>
          <div className="grid gap-2">
            <Label>SMTP User</Label>
            <Input
              value={channel.config.smtpUser || ''}
              onChange={(e) =>
                handleConfigChange(type, 'smtpUser', e.target.value)
              }
              placeholder="user@example.com"
            />
          </div>
        </div>
      )
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-secondary/20 p-4 rounded-lg border flex items-end gap-4">
        <div className="flex-1 space-y-2">
          <Label>Testar Conexão e Destinatário</Label>
          <Input
            placeholder="E-mail ou Telefone (E.164)"
            value={testRecipient}
            onChange={(e) => setTestRecipient(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* WhatsApp Cloud */}
        <Card className="border-0 shadow-subtle flex flex-col">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-green-600" /> WhatsApp
                Cloud
              </CardTitle>
              <Switch
                checked={getChannel('WHATSAPP_CLOUD')?.enabled}
                onCheckedChange={(c) => handleToggle('WHATSAPP_CLOUD', c)}
              />
            </div>
            <CardDescription>API Oficial da Meta.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            {getChannel('WHATSAPP_CLOUD')?.enabled ? (
              <>
                {renderConfigInputs('WHATSAPP_CLOUD')}
                <div className="mt-auto pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => handleSendTest('WHATSAPP_CLOUD')}
                    disabled={testingChannel === 'WHATSAPP_CLOUD'}
                  >
                    {testingChannel === 'WHATSAPP_CLOUD' ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Send className="h-3 w-3" />
                    )}
                    Testar Conexão
                  </Button>
                  <ConnectionStatus
                    status={connectionStatus['WHATSAPP_CLOUD']}
                  />
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground italic py-4">
                Canal desativado
              </div>
            )}
          </CardContent>
        </Card>

        {/* Evolution API */}
        <Card className="border-0 shadow-subtle flex flex-col">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="h-4 w-4 text-blue-600" /> Evolution API
              </CardTitle>
              <Switch
                checked={getChannel('EVOLUTION')?.enabled}
                onCheckedChange={(c) => handleToggle('EVOLUTION', c)}
              />
            </div>
            <CardDescription>Gateway multi-device.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            {getChannel('EVOLUTION')?.enabled ? (
              <>
                {renderConfigInputs('EVOLUTION')}
                <div className="mt-auto pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => handleSendTest('EVOLUTION')}
                    disabled={testingChannel === 'EVOLUTION'}
                  >
                    {testingChannel === 'EVOLUTION' ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Send className="h-3 w-3" />
                    )}
                    Testar Conexão
                  </Button>
                  <ConnectionStatus status={connectionStatus['EVOLUTION']} />
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground italic py-4">
                Canal desativado
              </div>
            )}
          </CardContent>
        </Card>

        {/* Email */}
        <Card className="border-0 shadow-subtle flex flex-col">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4 text-orange-600" /> Email (SMTP)
              </CardTitle>
              <Switch
                checked={getChannel('EMAIL')?.enabled}
                onCheckedChange={(c) => handleToggle('EMAIL', c)}
              />
            </div>
            <CardDescription>Envio transacional.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            {getChannel('EMAIL')?.enabled ? (
              <>
                {renderConfigInputs('EMAIL')}
                <div className="mt-auto pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => handleSendTest('EMAIL')}
                    disabled={testingChannel === 'EMAIL'}
                  >
                    {testingChannel === 'EMAIL' ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Send className="h-3 w-3" />
                    )}
                    Testar Conexão
                  </Button>
                  <ConnectionStatus status={connectionStatus['EMAIL']} />
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground italic py-4">
                Canal desativado
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
