import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import useUserPreferencesStore from '@/stores/useUserPreferencesStore'
import { Loader2, Save, Bell, Clock, Smartphone, Mail } from 'lucide-react'
import { UserPreference } from '@/types'

// Validation Schema
const notificationFormSchema = z
  .object({
    channels: z.object({
      email: z.boolean(),
      whatsapp: z.boolean(),
      sms: z.boolean(),
    }),
    contactInfo: z.object({
      email: z.string().email('E-mail inválido').optional().or(z.literal('')),
      phoneNumber: z.string().optional(),
    }),
    events: z.object({
      ticketCreated: z.boolean(),
      ticketAssigned: z.boolean(),
      newMessage: z.boolean(),
      ticketClosed: z.boolean(),
      mention: z.boolean(),
      newAttachment: z.boolean(),
      statusUpdated: z.boolean(),
    }),
    quietHours: z.object({
      enabled: z.boolean(),
      start: z.string().min(1, 'Horário inicial é obrigatório'),
      end: z.string().min(1, 'Horário final é obrigatório'),
    }),
    summaryMode: z.enum(['IMMEDIATE', 'HOURLY', 'DAILY']),
  })
  .superRefine((data, ctx) => {
    // Validate Phone Number if WhatsApp or SMS is enabled
    if (
      (data.channels.whatsapp || data.channels.sms) &&
      (!data.contactInfo.phoneNumber ||
        data.contactInfo.phoneNumber.trim() === '')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'O telefone é obrigatório para WhatsApp ou SMS.',
        path: ['contactInfo', 'phoneNumber'],
      })
    }

    // Validate Quiet Hours
    if (
      data.quietHours.enabled &&
      data.quietHours.start === data.quietHours.end
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'O horário de término deve ser diferente do início.',
        path: ['quietHours', 'end'],
      })
    }
  })

type NotificationFormValues = z.infer<typeof notificationFormSchema>

export function NotificationPreferences() {
  const { preferences, loading, savePreferences } = useUserPreferencesStore()

  const form = useForm<NotificationFormValues>({
    resolver: zodResolver(notificationFormSchema),
    defaultValues: {
      channels: { email: false, whatsapp: false, sms: false },
      contactInfo: { email: '', phoneNumber: '' },
      events: {
        ticketCreated: false,
        ticketAssigned: false,
        newMessage: false,
        ticketClosed: false,
        mention: false,
        newAttachment: false,
        statusUpdated: false,
      },
      quietHours: { enabled: false, start: '22:00', end: '08:00' },
      summaryMode: 'IMMEDIATE',
    },
  })

  // Load preferences into form
  useEffect(() => {
    if (preferences) {
      form.reset({
        channels: preferences.channels,
        contactInfo: {
          email: preferences.contactInfo.email || '',
          phoneNumber: preferences.contactInfo.phoneNumber || '',
        },
        events: preferences.events,
        quietHours: preferences.quietHours,
        summaryMode: preferences.summaryMode,
      })
    }
  }, [preferences, form])

  const onSubmit = async (data: NotificationFormValues) => {
    if (!preferences) return

    // Construct the UserPreference object to save
    const updatedPreferences: UserPreference = {
      userId: preferences.userId,
      channels: data.channels,
      contactInfo: {
        email: data.contactInfo.email || undefined,
        phoneNumber: data.contactInfo.phoneNumber || undefined,
      },
      events: data.events,
      quietHours: data.quietHours,
      summaryMode: data.summaryMode,
    }

    await savePreferences(updatedPreferences)
  }

  if (loading && !preferences) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin mb-4" />
        <p>Carregando preferências...</p>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Channels Section */}
        <Card className="border-0 shadow-subtle">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Smartphone className="h-5 w-5 text-primary" /> Canais de
              Comunicação
            </CardTitle>
            <CardDescription>
              Escolha por onde você deseja receber as notificações.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="channels.email"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">E-mail</FormLabel>
                      <FormDescription>Receber via e-mail</FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="channels.whatsapp"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">WhatsApp</FormLabel>
                      <FormDescription>Receber via app</FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="channels.sms"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">SMS</FormLabel>
                      <FormDescription>Mensagem de texto</FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            <div className="grid gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="contactInfo.phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Número de Telefone{' '}
                      <span className="text-muted-foreground text-xs font-normal">
                        (Obrigatório para WhatsApp/SMS)
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="+55 11 99999-9999" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contactInfo.email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      E-mail Alternativo{' '}
                      <span className="text-muted-foreground text-xs font-normal">
                        (Opcional)
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="seu.email@exemplo.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Events Section */}
        <Card className="border-0 shadow-subtle">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bell className="h-5 w-5 text-primary" /> Eventos
            </CardTitle>
            <CardDescription>
              Selecione quais atividades disparam uma notificação.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  id: 'ticketCreated',
                  label: 'Ticket Criado',
                  desc: 'Quando um novo chamado é aberto.',
                },
                {
                  id: 'ticketAssigned',
                  label: 'Ticket Atribuído',
                  desc: 'Quando um chamado é atribuído a você.',
                },
                {
                  id: 'newMessage',
                  label: 'Nova Mensagem',
                  desc: 'Respostas em chamados que você segue.',
                },
                {
                  id: 'ticketClosed',
                  label: 'Ticket Fechado',
                  desc: 'Quando um chamado é concluído.',
                },
                {
                  id: 'mention',
                  label: 'Menção (@)',
                  desc: 'Quando alguém te menciona em um comentário.',
                },
                {
                  id: 'newAttachment',
                  label: 'Novo Anexo',
                  desc: 'Quando um arquivo é anexado.',
                },
                {
                  id: 'statusUpdated',
                  label: 'Status Atualizado',
                  desc: 'Mudanças no estado do chamado.',
                },
              ].map((item) => (
                <FormField
                  key={item.id}
                  control={form.control}
                  name={`events.${item.id}` as any}
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>{item.label}</FormLabel>
                        <FormDescription className="text-xs">
                          {item.desc}
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quiet Hours Section */}
        <Card className="border-0 shadow-subtle">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-primary" /> Horário de Silêncio
            </CardTitle>
            <CardDescription>
              Pause as notificações durante períodos específicos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="quietHours.enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Ativar Silêncio</FormLabel>
                    <FormDescription>
                      Não enviar notificações neste intervalo.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {form.watch('quietHours.enabled') && (
              <div className="grid grid-cols-2 gap-4 animate-fade-in-down">
                <FormField
                  control={form.control}
                  name="quietHours.start"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horário de Início</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="quietHours.end"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horário de Término</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Mode Section */}
        <Card className="border-0 shadow-subtle">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Mail className="h-5 w-5 text-primary" /> Modo Resumo
            </CardTitle>
            <CardDescription>
              Defina a frequência com que você deseja ser notificado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="summaryMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Frequência</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a frequência" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="IMMEDIATE">
                        Imediato (Assim que ocorrer)
                      </SelectItem>
                      <SelectItem value="HOURLY">
                        A cada hora (Resumo)
                      </SelectItem>
                      <SelectItem value="DAILY">
                        Diário (Resumo do dia)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Action Button */}
        <div className="flex justify-end sticky bottom-6 z-10">
          <Button type="submit" size="lg" disabled={loading} className="gap-2">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {loading ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
