import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ReportTemplate } from '@/types'
import { useReportStore } from '@/stores/useReportStore'
import { useEffect } from 'react'

const formSchema = z.object({
  name: z.string().min(3, 'Nome muito curto'),
  metrics: z.array(z.string()).min(1, 'Selecione pelo menos uma métrica'),
  channels: z.array(z.string()).min(1, 'Selecione pelo menos um canal'),
  recipientEmails: z.string(), // Comma separated for ease
  recipientPhones: z.string(), // Comma separated for ease
  frequencyDays: z.coerce.number().min(1, 'Frequência mínima de 1 dia'),
  isActive: z.boolean(),
})

interface ReportFormProps {
  initialData?: ReportTemplate
  organizationId: string
  onSuccess: () => void
}

const METRICS_OPTIONS = [
  { id: 'trends', label: 'Tendências de Chamados' },
  { id: 'agents', label: 'Performance de Agentes' },
  { id: 'categories', label: 'Distribuição por Categoria' },
  { id: 'sla', label: 'Conformidade de SLA' },
  { id: 'status', label: 'Visão Geral de Status' },
  { id: 'cost', label: 'Custo por Ticket (Novo)' },
  { id: 'resolution_time', label: 'Tempo Médio de Resolução (Novo)' },
  { id: 'csat', label: 'Índice de Satisfação - CSAT (Novo)' },
]

const CHANNEL_OPTIONS = [
  { id: 'EMAIL', label: 'E-mail' },
  { id: 'WHATSAPP_CLOUD', label: 'WhatsApp' },
]

export function ReportForm({
  initialData,
  organizationId,
  onSuccess,
}: ReportFormProps) {
  const { addTemplate, updateTemplate } = useReportStore()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      metrics: [],
      channels: [],
      recipientEmails: '',
      recipientPhones: '',
      frequencyDays: 7,
      isActive: true,
    },
  })

  useEffect(() => {
    if (initialData) {
      form.reset({
        name: initialData.name,
        metrics: initialData.metrics,
        channels: initialData.channels,
        recipientEmails: initialData.recipientEmails.join(', '),
        recipientPhones: initialData.recipientPhones.join(', '),
        frequencyDays: initialData.frequencyDays,
        isActive: initialData.isActive,
      })
    }
  }, [initialData, form])

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const formattedData = {
      ...values,
      organizationId,
      recipientEmails: values.recipientEmails
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      recipientPhones: values.recipientPhones
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    }

    if (initialData) {
      await updateTemplate(initialData.id, formattedData)
    } else {
      await addTemplate(formattedData)
    }
    onSuccess()
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome do Relatório</FormLabel>
              <FormControl>
                <Input
                  placeholder="Ex: Relatório Semanal Executivo"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="metrics"
          render={() => (
            <FormItem>
              <div className="mb-4">
                <FormLabel className="text-base">Métricas</FormLabel>
                <FormDescription>
                  Selecione os dados que serão incluídos no relatório.
                </FormDescription>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {METRICS_OPTIONS.map((item) => (
                  <FormField
                    key={item.id}
                    control={form.control}
                    name="metrics"
                    render={({ field }) => {
                      return (
                        <FormItem
                          key={item.id}
                          className="flex flex-row items-start space-x-3 space-y-0"
                        >
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(item.id)}
                              onCheckedChange={(checked) => {
                                return checked
                                  ? field.onChange([...field.value, item.id])
                                  : field.onChange(
                                      field.value?.filter(
                                        (value) => value !== item.id,
                                      ),
                                    )
                              }}
                            />
                          </FormControl>
                          <FormLabel className="font-normal">
                            {item.label}
                          </FormLabel>
                        </FormItem>
                      )
                    }}
                  />
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="channels"
          render={() => (
            <FormItem>
              <div className="mb-4">
                <FormLabel className="text-base">Canais de Envio</FormLabel>
                <FormDescription>
                  Por onde o relatório será enviado.
                </FormDescription>
              </div>
              <div className="flex gap-4">
                {CHANNEL_OPTIONS.map((item) => (
                  <FormField
                    key={item.id}
                    control={form.control}
                    name="channels"
                    render={({ field }) => {
                      return (
                        <FormItem
                          key={item.id}
                          className="flex flex-row items-start space-x-3 space-y-0"
                        >
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(item.id)}
                              onCheckedChange={(checked) => {
                                return checked
                                  ? field.onChange([...field.value, item.id])
                                  : field.onChange(
                                      field.value?.filter(
                                        (value) => value !== item.id,
                                      ),
                                    )
                              }}
                            />
                          </FormControl>
                          <FormLabel className="font-normal">
                            {item.label}
                          </FormLabel>
                        </FormItem>
                      )
                    }}
                  />
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="recipientEmails"
            render={({ field }) => (
              <FormItem>
                <FormLabel>E-mails Adicionais</FormLabel>
                <FormControl>
                  <Input placeholder="Separados por vírgula" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="recipientPhones"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefones Adicionais (WhatsApp)</FormLabel>
                <FormControl>
                  <Input placeholder="Separados por vírgula" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="frequencyDays"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Frequência (Dias)</FormLabel>
              <FormControl>
                <Input type="number" min={1} {...field} />
              </FormControl>
              <FormDescription>Enviar a cada X dias.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>Ativo</FormLabel>
                <FormDescription>Habilitar envio automático.</FormDescription>
              </div>
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full">
          Salvar Modelo
        </Button>
      </form>
    </Form>
  )
}
