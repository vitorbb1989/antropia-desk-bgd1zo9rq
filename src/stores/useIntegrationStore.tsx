import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
} from 'react'
import { IntegrationConfig, IntegrationLog } from '@/types'
import { integrationService } from '@/services/integrationService'
import useAuthStore from './useAuthStore'
import { toast } from 'sonner'
import { format } from 'date-fns'

export interface IntegrationStats {
  totalExecutions: number
  successRate: number
  avgDurationMs: number
  activeProviders: string[]
  providerBreakdown: { provider: string; success: number; failed: number }[]
  dailyTrend: { date: string; success: number; failed: number }[]
  providerHealth: { provider: string; lastStatus: string; consecutiveFailures: number }[]
}

interface IntegrationContextType {
  integrations: IntegrationConfig[]
  logs: IntegrationLog[]
  stats: IntegrationStats | null
  loading: boolean
  fetchIntegrations: () => Promise<void>
  fetchLogs: () => Promise<void>
  fetchLogsFiltered: (filters: { provider?: string; status?: string; dateFrom?: string; dateTo?: string }) => Promise<void>
  fetchStats: () => Promise<void>
  saveIntegration: (config: Partial<IntegrationConfig>) => Promise<void>
  testConnection: (provider: string, settings: any) => Promise<boolean>
}

const IntegrationContext = createContext<IntegrationContextType | null>(null)

function computeStats(
  rawData: { status: string; integration_type: string; duration_ms: number | null; created_at: string }[],
): IntegrationStats {
  const total = rawData.length
  const successCount = rawData.filter((r) => r.status === 'SUCCESS').length
  const successRate = total > 0 ? Math.round((successCount / total) * 100) : 0

  const durationsMs = rawData.filter((r) => r.duration_ms != null).map((r) => r.duration_ms!)
  const avgDurationMs = durationsMs.length > 0
    ? Math.round(durationsMs.reduce((a, b) => a + b, 0) / durationsMs.length)
    : 0

  // Provider breakdown
  const providerMap: Record<string, { success: number; failed: number }> = {}
  for (const r of rawData) {
    if (!providerMap[r.integration_type]) providerMap[r.integration_type] = { success: 0, failed: 0 }
    if (r.status === 'SUCCESS') providerMap[r.integration_type].success++
    else if (r.status === 'FAILED') providerMap[r.integration_type].failed++
  }
  const providerBreakdown = Object.entries(providerMap).map(([provider, counts]) => ({
    provider,
    ...counts,
  }))

  const activeProviders = Object.keys(providerMap)

  // Daily trend (last 14 days)
  const fourteenDaysAgo = Date.now() - 14 * 86400000
  const recentData = rawData.filter((r) => new Date(r.created_at).getTime() >= fourteenDaysAgo)
  const dayMap: Record<string, { success: number; failed: number }> = {}
  for (const r of recentData) {
    const day = format(new Date(r.created_at), 'dd/MM')
    if (!dayMap[day]) dayMap[day] = { success: 0, failed: 0 }
    if (r.status === 'SUCCESS') dayMap[day].success++
    else if (r.status === 'FAILED') dayMap[day].failed++
  }
  const dailyTrend = Object.entries(dayMap).map(([date, counts]) => ({
    date,
    ...counts,
  }))

  // Provider health (last status + consecutive failures)
  const providerHealth: IntegrationStats['providerHealth'] = []
  for (const provider of activeProviders) {
    const providerLogs = rawData.filter((r) => r.integration_type === provider)
    const lastLog = providerLogs[providerLogs.length - 1]
    let consecutiveFailures = 0
    for (let i = providerLogs.length - 1; i >= 0; i--) {
      if (providerLogs[i].status === 'FAILED') consecutiveFailures++
      else break
    }
    providerHealth.push({
      provider,
      lastStatus: lastLog?.status || 'UNKNOWN',
      consecutiveFailures,
    })
  }

  return {
    totalExecutions: total,
    successRate,
    avgDurationMs,
    activeProviders,
    providerBreakdown,
    dailyTrend,
    providerHealth,
  }
}

export function IntegrationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthStore()
  const [integrations, setIntegrations] = useState<IntegrationConfig[]>([])
  const [logs, setLogs] = useState<IntegrationLog[]>([])
  const [stats, setStats] = useState<IntegrationStats | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchIntegrations = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const data = await integrationService.getIntegrations(user.companyId)
      setIntegrations(data)
    } catch (e) {
      toast.error('Erro ao carregar integrações')
    } finally {
      setLoading(false)
    }
  }, [user])

  const fetchLogs = useCallback(async () => {
    if (!user) return
    try {
      const data = await integrationService.getLogs(user.companyId)
      setLogs(data)
    } catch (e) {
      console.error(e)
    }
  }, [user])

  const fetchLogsFiltered = useCallback(async (filters: { provider?: string; status?: string; dateFrom?: string; dateTo?: string }) => {
    if (!user) return
    try {
      const data = await integrationService.getLogsFiltered(user.companyId, filters)
      setLogs(data)
    } catch (e) {
      console.error(e)
    }
  }, [user])

  const fetchStats = useCallback(async () => {
    if (!user) return
    try {
      const rawData = await integrationService.getLogStats(user.companyId)
      if (rawData) {
        setStats(computeStats(rawData))
      }
    } catch (e) {
      console.error(e)
    }
  }, [user])

  const saveIntegration = async (config: Partial<IntegrationConfig>) => {
    if (!user) return
    try {
      await integrationService.saveIntegration({
        ...config,
        organizationId: user.companyId,
      })
      toast.success('Configuração salva com sucesso')
      await fetchIntegrations()
    } catch (e) {
      toast.error('Erro ao salvar configuração')
    }
  }

  const testConnection = async (provider: string, settings: any) => {
    try {
      const res = await integrationService.testConnection(provider, settings)
      if (res.success) {
        toast.success('Conexão bem sucedida!')
        return true
      } else {
        toast.error(`Falha na conexão: ${res.error}`)
        return false
      }
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`)
      return false
    }
  }

  return (
    <IntegrationContext.Provider
      value={{
        integrations,
        logs,
        stats,
        loading,
        fetchIntegrations,
        fetchLogs,
        fetchLogsFiltered,
        fetchStats,
        saveIntegration,
        testConnection,
      }}
    >
      {children}
    </IntegrationContext.Provider>
  )
}

export const useIntegrationStore = () => {
  const context = useContext(IntegrationContext)
  if (!context)
    throw new Error(
      'useIntegrationStore must be used within IntegrationProvider',
    )
  return context
}
