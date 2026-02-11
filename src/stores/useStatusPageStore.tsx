import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react'
import { Ticket } from '@/types'
import { statusService } from '@/services/statusService'
import { supabase } from '@/lib/supabase/client'
import useAuthStore from './useAuthStore'
import { toast } from 'sonner'
import {
  differenceInHours,
  isToday,
  parseISO,
  subDays,
  format,
  startOfDay,
} from 'date-fns'
import { exportService } from '@/services/exportService'
import { translatePriority, translateStatus } from '@/utils/translations'

type PeriodFilter = 'TODAY' | '7_DAYS' | '30_DAYS' | 'ALL'

export interface AlertConfig {
  visual: boolean
  audio: boolean
  triggers: string[]
}

interface StatusPageContextType {
  tickets: any[]
  loading: boolean
  filters: {
    status: string
    organizationId: string
    period: PeriodFilter
    priority: string
  }
  kpis: {
    active: number
    waitingApproval: number
    closedToday: number
    avgResolutionHours: number
  }
  chartsData: {
    status: Record<string, number>
    priority: Record<string, number>
    organization: any[]
    trends: any[]
  }
  alertConfig: AlertConfig
  setAlertConfig: (config: AlertConfig) => void
  setFilter: (key: string, value: string) => void
  refresh: () => Promise<void>
  lastUpdated: Date
  exportData: (format: 'csv' | 'pdf') => void
}

const StatusPageContext = createContext<StatusPageContextType | null>(null)

const DEFAULT_ALERT_CONFIG: AlertConfig = {
  visual: true,
  audio: true,
  triggers: ['URGENT', 'STATUS_CHANGE'],
}

export function StatusPageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthStore()
  const [allTickets, setAllTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [alertConfig, setAlertConfig] =
    useState<AlertConfig>(DEFAULT_ALERT_CONFIG)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const [filters, setFilters] = useState({
    status: 'ALL',
    organizationId: 'ALL',
    period: '30_DAYS' as PeriodFilter,
    priority: 'ALL',
  })

  // Initialize Audio
  useEffect(() => {
    audioRef.current = new Audio(
      'https://actions.google.com/sounds/v1/alarms/beep_short.ogg',
    )
  }, [])

  const playAlertSound = useCallback(() => {
    if (alertConfig.audio && audioRef.current) {
      audioRef.current.play().catch((e) => console.log('Audio play blocked', e))
    }
  }, [alertConfig.audio])

  const fetchTickets = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      // Fetch data based on max period needed for charts (30 days default)
      const data = await statusService.getMonitoringTickets(user.companyId, 30)
      setAllTickets(data)
      setLastUpdated(new Date())
    } catch (e) {
      console.error(e)
      toast.error('Erro ao carregar dados do painel')
    } finally {
      setLoading(false)
    }
  }, [user])

  // Initial Fetch & Realtime Subscription
  useEffect(() => {
    if (!user) return

    fetchTickets()

    const channel = supabase
      .channel('status-page-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
          filter: `organization_id=eq.${user.companyId}`,
        },
        (payload) => {
          let shouldAlert = false
          let alertMsg = ''

          if (payload.eventType === 'INSERT') {
            const newTicket = payload.new as any
            setAllTickets((prev) => [
              {
                ...newTicket,
                readableId: newTicket.id.split('-')[0],
                createdAt: newTicket.created_at,
                updatedAt: newTicket.updated_at,
                companyId: newTicket.organization_id,
                organizationName: 'Novo', // Needs refresh for correct name or fetch
              },
              ...prev,
            ])

            if (
              newTicket.priority === 'URGENT' &&
              alertConfig.triggers.includes('URGENT')
            ) {
              shouldAlert = true
              alertMsg = `Novo chamado URGENTE: ${newTicket.title}`
            } else if (alertConfig.triggers.includes('NEW_TICKET')) {
              shouldAlert = true
              alertMsg = `Novo chamado: ${newTicket.title}`
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as any
            const old = payload.old as any

            setAllTickets((prev) =>
              prev.map((t) =>
                t.id === updated.id
                  ? { ...t, ...updated, updatedAt: updated.updated_at }
                  : t,
              ),
            )

            if (
              updated.status !== old.status &&
              alertConfig.triggers.includes('STATUS_CHANGE')
            ) {
              shouldAlert = true
              alertMsg = `Status atualizado: ${updated.title}`
            }
          } else if (payload.eventType === 'DELETE') {
            setAllTickets((prev) => prev.filter((t) => t.id !== payload.old.id))
          }

          setLastUpdated(new Date())

          if (shouldAlert) {
            if (alertConfig.visual) toast.info(alertMsg)
            playAlertSound()
          }
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('Realtime subscription error on status-page-realtime')
          toast.error('Erro na conexao em tempo real. Dados podem estar desatualizados.')
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, fetchTickets, alertConfig, playAlertSound])

  const setFilter = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  // Filter Logic
  const filteredTickets = useMemo(() => {
    return allTickets.filter((t) => {
      // Status Filter
      if (filters.status !== 'ALL' && t.status !== filters.status) return false

      // Priority Filter
      if (filters.priority !== 'ALL' && t.priority !== filters.priority)
        return false

      // Period Filter
      const created = parseISO(t.createdAt)
      const now = new Date()
      if (filters.period === 'TODAY' && !isToday(created)) return false
      if (filters.period === '7_DAYS' && created < subDays(now, 7)) return false
      if (filters.period === '30_DAYS' && created < subDays(now, 30))
        return false

      return true
    })
  }, [allTickets, filters])

  // KPI Calculation
  const kpis = useMemo(() => {
    const active = allTickets.filter((t) => t.status !== 'CLOSED').length
    const waitingApproval = allTickets.filter(
      (t) => t.status === 'WAITING_APPROVAL',
    ).length
    const closedToday = allTickets.filter(
      (t) => t.status === 'CLOSED' && isToday(parseISO(t.updatedAt)),
    ).length

    // Avg Resolution for CLOSED tickets
    const closedTickets = allTickets.filter((t) => t.status === 'CLOSED')
    let totalHours = 0
    closedTickets.forEach((t) => {
      totalHours += differenceInHours(
        parseISO(t.updatedAt),
        parseISO(t.createdAt),
      )
    })
    const avgResolutionHours =
      closedTickets.length > 0 ? totalHours / closedTickets.length : 0

    return { active, waitingApproval, closedToday, avgResolutionHours }
  }, [allTickets])

  // Charts Data Calculation
  const chartsData = useMemo(() => {
    const status: Record<string, number> = {}
    const priority: Record<string, number> = {}
    const organization: Record<string, number> = {}
    const trendsMap: Record<string, { created: number; resolved: number }> = {}

    // Initialize trends map for the selected period to avoid gaps
    const now = new Date()
    const days =
      filters.period === 'TODAY' ? 1 : filters.period === '7_DAYS' ? 7 : 30

    for (let i = 0; i < days; i++) {
      const d = subDays(now, i)
      const dateKey = format(d, 'yyyy-MM-dd')
      trendsMap[dateKey] = { created: 0, resolved: 0 }
    }

    filteredTickets.forEach((t) => {
      // Status
      status[t.status] = (status[t.status] || 0) + 1
      // Priority
      priority[t.priority] = (priority[t.priority] || 0) + 1
      // Organization
      if (t.organizationName) {
        organization[t.organizationName] =
          (organization[t.organizationName] || 0) + 1
      }

      // Trends
      const dateKey = format(parseISO(t.createdAt), 'yyyy-MM-dd')
      if (trendsMap[dateKey]) {
        trendsMap[dateKey].created += 1
      }

      if (t.status === 'CLOSED') {
        const resolvedDateKey = format(parseISO(t.updatedAt), 'yyyy-MM-dd')
        if (trendsMap[resolvedDateKey]) {
          trendsMap[resolvedDateKey].resolved += 1
        }
      }
    })

    const trends = Object.entries(trendsMap)
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    const orgData = Object.entries(organization).map(([name, count]) => ({
      name,
      count,
    }))

    return { status, priority, organization: orgData, trends }
  }, [filteredTickets, filters.period])

  const exportData = (formatType: 'csv' | 'pdf') => {
    if (formatType === 'pdf') {
      exportService.print()
      return
    }

    const headers = [
      'ID',
      'Título',
      'Status',
      'Prioridade',
      'Organização',
      'Data Criação',
    ]
    const keys = [
      'readableId',
      'title',
      'statusTranslated',
      'priorityTranslated',
      'organizationName',
      'createdAtFormatted',
    ]

    const dataToExport = filteredTickets.map((t) => ({
      ...t,
      statusTranslated: translateStatus(t.status),
      priorityTranslated: translatePriority(t.priority),
      createdAtFormatted: format(parseISO(t.createdAt), 'dd/MM/yyyy HH:mm'),
    }))

    exportService.toCSV(dataToExport, headers, keys, 'relatorio_status_page')
  }

  return (
    <StatusPageContext.Provider
      value={{
        tickets: filteredTickets,
        loading,
        filters,
        setFilter,
        refresh: fetchTickets,
        kpis,
        lastUpdated,
        chartsData,
        alertConfig,
        setAlertConfig,
        exportData,
      }}
    >
      {children}
    </StatusPageContext.Provider>
  )
}

export const useStatusPageStore = () => {
  const context = useContext(StatusPageContext)
  if (!context)
    throw new Error('useStatusPageStore must be used within StatusPageProvider')
  return context
}
