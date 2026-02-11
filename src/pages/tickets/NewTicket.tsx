import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import useTicketStore from '@/stores/useTicketStore'
import useCategoryStore from '@/stores/useCategoryStore'
import useServicePlanStore from '@/stores/useServicePlanStore'
import useAuthStore from '@/stores/useAuthStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { ArrowLeft, Loader2, Send, Clock, CheckCircle2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import type { TicketPriority, TicketType, UserServiceCategory } from '@/types'

const ticketSchema = z.object({
  title: z.string().min(5, 'O titulo deve ter pelo menos 5 caracteres'),
  description: z
    .string()
    .min(10, 'A descricao deve ter pelo menos 10 caracteres'),
  categoryId: z.string().min(1, 'Selecione uma categoria'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  type: z.enum(['BUG', 'REQUEST', 'FINANCE', 'OTHER']).default('REQUEST'),
})

type TicketFormValues = z.infer<typeof ticketSchema>

function formatSla(hours: number): string {
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  const remaining = hours % 24
  if (remaining === 0) return `${days} dia${days > 1 ? 's' : ''}`
  return `${days}d ${remaining}h`
}

export default function NewTicket() {
  const navigate = useNavigate()
  const { addTicket } = useTicketStore()
  const { categories, fetchCategories } = useCategoryStore()
  const { userCategories, loading: loadingPlans } = useServicePlanStore()
  const { user } = useAuthStore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [activePlanFilter, setActivePlanFilter] = useState<string | null>(null)

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const isClient = user?.role === 'USER'

  // Group user categories by service plan
  const groupedCategories = useMemo(() => {
    if (!isClient || userCategories.length === 0) return null

    const groups: Record<string, {
      planId: string
      planName: string
      planColor: string
      categories: UserServiceCategory[]
    }> = {}

    for (const uc of userCategories) {
      if (!groups[uc.servicePlanId]) {
        groups[uc.servicePlanId] = {
          planId: uc.servicePlanId,
          planName: uc.servicePlanName,
          planColor: uc.servicePlanColor,
          categories: [],
        }
      }
      groups[uc.servicePlanId].categories.push(uc)
    }

    return Object.values(groups)
  }, [isClient, userCategories])

  // Filtered categories based on active plan filter
  const visibleGroups = useMemo(() => {
    if (!groupedCategories) return null
    if (!activePlanFilter) return groupedCategories
    return groupedCategories.filter((g) => g.planId === activePlanFilter)
  }, [groupedCategories, activePlanFilter])

  // Selected category details
  const selectedCategory = useMemo(() => {
    if (!selectedCategoryId) return null
    if (isClient) {
      return userCategories.find((uc) => uc.categoryId === selectedCategoryId) || null
    }
    const cat = categories.find((c) => c.id === selectedCategoryId)
    if (!cat) return null
    return {
      categoryId: cat.id,
      categoryName: cat.name,
      categoryDescription: cat.description,
      categorySlaHours: cat.slaHours,
      categoryColor: cat.color,
      categorySlug: cat.slug,
      servicePlanId: '',
      servicePlanName: '',
      servicePlanColor: '',
      servicePlanIcon: '',
    } as UserServiceCategory
  }, [selectedCategoryId, isClient, userCategories, categories])

  const form = useForm<TicketFormValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      title: '',
      description: '',
      categoryId: '',
      priority: 'MEDIUM',
      type: 'REQUEST',
    },
  })

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategoryId(categoryId)
    form.setValue('categoryId', categoryId, { shouldValidate: true })
  }

  const onSubmit = async (data: TicketFormValues) => {
    if (!user) return
    setIsSubmitting(true)
    try {
      await addTicket({
        title: data.title,
        description: data.description,
        priority: data.priority as TicketPriority,
        type: data.type as TicketType,
        status: 'RECEIVED',
        requesterId: user.id,
        companyId: user.companyId,
        categoryId: data.categoryId,
        assigneeId: undefined,
        estimatedCost: 0,
        satisfactionScore: undefined,
        satisfactionComment: undefined,
        dueDate: undefined,
        tags: [],
      })
      toast.success('Chamado criado com sucesso!')
      navigate('/tickets')
    } catch (error) {
      toast.error('Erro ao criar chamado. Tente novamente.')
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // CLIENT VIEW: card-based category selection grouped by service plan
  const renderClientCategorySelector = () => {
    if (loadingPlans) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )
    }

    if (!groupedCategories || groupedCategories.length === 0) {
      return (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
            <p className="text-sm font-medium">Nenhum servico vinculado</p>
            <p className="text-xs text-muted-foreground mt-1">
              Entre em contato com o administrador para vincular seus servicos contratados.
            </p>
          </CardContent>
        </Card>
      )
    }

    return (
      <div className="space-y-4">
        {/* Plan filter tabs */}
        {groupedCategories.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            <Button
              type="button"
              variant={activePlanFilter === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActivePlanFilter(null)}
            >
              Todos
            </Button>
            {groupedCategories.map((group) => (
              <Button
                key={group.planId}
                type="button"
                variant={activePlanFilter === group.planId ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActivePlanFilter(group.planId)}
                className="gap-2"
              >
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: group.planColor }}
                />
                {group.planName}
              </Button>
            ))}
          </div>
        )}

        {/* Category cards */}
        {visibleGroups?.map((group) => (
          <div key={group.planId} className="space-y-3">
            <div className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: group.planColor }}
              />
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {group.planName}
              </h3>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {group.categories.map((cat) => {
                const isSelected = selectedCategoryId === cat.categoryId
                return (
                  <button
                    key={cat.categoryId}
                    type="button"
                    onClick={() => handleCategorySelect(cat.categoryId)}
                    className={`text-left rounded-xl border-2 p-4 transition-all hover:shadow-md ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          {isSelected && (
                            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                          )}
                          <span className="font-semibold text-sm">
                            {cat.categoryName}
                          </span>
                        </div>
                        {cat.categoryDescription && (
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {cat.categoryDescription}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 rounded-full bg-muted px-3 py-1">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">
                          {formatSla(cat.categorySlaHours)}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ADMIN/AGENT VIEW: standard dropdown
  const renderAdminCategorySelector = () => (
    <FormField
      control={form.control}
      name="categoryId"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Categoria</FormLabel>
          <Select
            onValueChange={(val) => {
              field.onChange(val)
              setSelectedCategoryId(val)
            }}
            defaultValue={field.value}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
              {categories.length === 0 && (
                <SelectItem value="default" disabled>
                  Nenhuma categoria disponivel
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  )

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="rounded-full"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Novo Chamado</h1>
          <p className="text-muted-foreground">
            {isClient
              ? 'Selecione o tipo de solicitacao e descreva detalhadamente.'
              : 'Descreva sua solicitacao detalhadamente.'}
          </p>
        </div>
      </div>

      <Card className="border-0 shadow-subtle">
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* STEP 1: Category selection */}
              {isClient ? (
                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="categoryId"
                    render={() => (
                      <FormItem>
                        <FormLabel className="text-base">Tipo de Solicitacao</FormLabel>
                        <FormDescription>
                          Escolha o tipo de chamado. O prazo estimado de resolucao e exibido ao lado.
                        </FormDescription>
                        {renderClientCategorySelector()}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {renderAdminCategorySelector()}
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prioridade</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="LOW">Baixa</SelectItem>
                            <SelectItem value="MEDIUM">Media</SelectItem>
                            <SelectItem value="HIGH">Alta</SelectItem>
                            <SelectItem value="URGENT">Urgente</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Urgente: Impacto critico no negocio.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Selected category confirmation banner (client only) */}
              {isClient && selectedCategory && (
                <div
                  className="rounded-lg border-l-4 bg-muted/30 p-4"
                  style={{ borderLeftColor: selectedCategory.categoryColor }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="font-semibold text-sm">{selectedCategory.categoryName}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Prazo estimado de resolucao: <strong>{formatSla(selectedCategory.categorySlaHours)}</strong>
                  </p>
                </div>
              )}

              {/* Hidden priority for clients */}
              {isClient && (
                <input type="hidden" {...form.register('priority')} value="MEDIUM" />
              )}

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assunto</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Resumo da solicitacao..."
                        {...field}
                        className="text-lg font-medium"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descricao Detalhada</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Descreva o que precisa, inclua detalhes relevantes..."
                        className="min-h-[200px] resize-y"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/tickets')}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || (isClient && !selectedCategoryId)}
                  className="min-w-[150px]"
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Abrir Chamado
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
