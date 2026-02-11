import { supabase } from '@/lib/supabase/client'
import { IntegrationConfig, IntegrationLog } from '@/types'
import { isValidUUID } from '@/lib/utils'

function mapLog(l: any): IntegrationLog {
  return {
    id: l.id,
    organizationId: l.organization_id,
    integrationType: l.integration_type,
    status: l.status,
    requestData: l.request_data,
    responseData: l.response_data,
    errorMessage: l.error_message,
    durationMs: l.duration_ms ?? null,
    createdAt: l.created_at,
  }
}

export const integrationService = {
  async getIntegrations(organizationId: string) {
    if (!isValidUUID(organizationId)) return []

    const { data, error } = await supabase
      .from('integrations_config')
      .select('*')
      .eq('organization_id', organizationId)

    if (error) throw error

    return data.map((i: any) => ({
      id: i.id,
      organizationId: i.organization_id,
      provider: i.provider,
      settings: i.settings,
      isEnabled: i.is_enabled,
      updatedAt: i.updated_at,
    })) as IntegrationConfig[]
  },

  async saveIntegration(integration: Partial<IntegrationConfig>) {
    const { error } = await supabase.from('integrations_config').upsert(
      {
        organization_id: integration.organizationId,
        provider: integration.provider,
        settings: integration.settings,
        is_enabled: integration.isEnabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'organization_id, provider' },
    )

    if (error) throw error
  },

  async testConnection(provider: string, config: any) {
    const { data, error } = await supabase.functions.invoke(
      'test-integration',
      { body: { provider, config } },
    )

    if (error) throw error
    return data
  },

  async getLogs(organizationId: string, limit = 50) {
    if (!isValidUUID(organizationId)) return []

    const { data, error } = await supabase
      .from('integration_logs')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data.map(mapLog)
  },

  async getLogsFiltered(
    organizationId: string,
    filters: { provider?: string; status?: string; dateFrom?: string; dateTo?: string },
    limit = 50,
  ) {
    if (!isValidUUID(organizationId)) return []

    let query = supabase
      .from('integration_logs')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (filters.provider) query = query.eq('integration_type', filters.provider)
    if (filters.status) query = query.eq('status', filters.status)
    if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom)
    if (filters.dateTo) query = query.lte('created_at', filters.dateTo)

    const { data, error } = await query
    if (error) throw error
    return data.map(mapLog)
  },

  async getLogStats(organizationId: string) {
    if (!isValidUUID(organizationId)) return null

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()

    // Fetch all non-PENDING logs from last 30 days for client-side aggregation
    const { data, error } = await supabase
      .from('integration_logs')
      .select('status, integration_type, duration_ms, created_at')
      .eq('organization_id', organizationId)
      .neq('status', 'PENDING')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data as { status: string; integration_type: string; duration_ms: number | null; created_at: string }[]
  },
}
