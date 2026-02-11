import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from 'react'
import {
  SystemSettings,
  NotificationChannelConfig,
  NotificationTemplate,
  NotificationChannelType,
  BrandingSettings,
  NotificationEventType,
} from '@/types'
import { settingsService } from '@/services/settingsService'
import useAuthStore from './useAuthStore'
import { toast } from 'sonner'

const DEFAULT_BRANDING: BrandingSettings = {
  logoUrl: 'https://img.usecurling.com/i?q=Antropia&shape=outline&color=blue',
  iconUrl: 'https://img.usecurling.com/i?q=Antropia&shape=fill&color=blue',
  faviconUrl: '/favicon.ico',
  primaryColor: '#3b82f6',
}

const DEFAULT_TEMPLATES: NotificationTemplate[] = [
  {
    id: 'tpl_default_created',
    organizationId: '',
    channel: 'DEFAULT',
    eventType: 'TICKET_CREATED',
    name: 'Default Created',
    bodyTemplate:
      '✅ *Chamado recebido* ({{ticket.public_id}})\n\n{{ticket.title}}\nStatus: *Recebido*\n\nAcompanhe aqui: {{ticket.portal_url}}\n\n— {{company.name}}',
    enabled: true,
  },
]

const DEFAULT_CHANNELS: NotificationChannelConfig[] = [
  {
    type: 'WHATSAPP_CLOUD',
    enabled: false,
    config: { phoneNumberId: '', wabaId: '', apiKey: '' },
  },
  {
    type: 'EVOLUTION',
    enabled: false,
    config: { instanceName: '', serverUrl: '', apiKey: '' },
  },
  {
    type: 'EMAIL',
    enabled: true,
    config: {
      smtpHost: 'smtp.mailgun.org',
      smtpPort: '587',
      smtpUser: 'postmaster@domain.com',
      senderEmail: 'no-reply@antropia.com',
    },
  },
]

const DEFAULT_SETTINGS: SystemSettings = {
  maxFileSize: 10,
  allowedFileTypes: ['pdf', 'png', 'jpg', 'jpeg'],
  notificationChannels: DEFAULT_CHANNELS,
  notificationTemplates: DEFAULT_TEMPLATES,
  branding: DEFAULT_BRANDING,
}

interface SettingsContextType {
  settings: SystemSettings
  loading: boolean
  updateSettings: (newSettings: Partial<SystemSettings>) => void
  updateChannelConfig: (
    type: NotificationChannelType,
    enabled: boolean,
    config: Partial<NotificationChannelConfig['config']>,
  ) => Promise<void>
  updateTemplate: (
    eventType: NotificationEventType,
    channel: NotificationChannelType | 'DEFAULT',
    content: string,
    subject: string | undefined,
    enabled: boolean,
  ) => void
  updateBranding: (branding: Partial<BrandingSettings>) => void
  getEffectiveTemplate: (
    eventType: NotificationEventType,
    channel: NotificationChannelType,
  ) => NotificationTemplate | undefined
  testChannel: (
    type: NotificationChannelType,
    recipient: string,
  ) => Promise<void>
}

const SettingsContext = createContext<SettingsContextType | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(false)
  const { user } = useAuthStore()

  // Load from Supabase on mount/user change
  useEffect(() => {
    async function loadSettings() {
      if (!user) return
      setLoading(true)
      try {
        const orgSettings = await settingsService.getOrgSettings(user.companyId)

        if (orgSettings) {
          setSettings((prev) => ({
            ...prev,
            notificationChannels: orgSettings.notificationChannels,
            branding: {
              ...prev.branding,
              ...(orgSettings.branding || {}),
            },
          }))
        }
      } catch (e) {
        console.error('Failed to load settings', e)
        toast.error('Erro ao carregar configurações da organização')
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [user])

  const updateSettings = (partialSettings: Partial<SystemSettings>) => {
    setSettings({ ...settings, ...partialSettings })
  }

  const updateChannelConfig = async (
    type: NotificationChannelType,
    enabled: boolean,
    config: Partial<NotificationChannelConfig['config']>,
  ) => {
    if (!user) return

    const prevChannels = settings.notificationChannels
    const newChannels = settings.notificationChannels.map((ch) =>
      ch.type === type
        ? { ...ch, enabled, config: { ...ch.config, ...config } }
        : ch,
    )

    setSettings((prev) => ({ ...prev, notificationChannels: newChannels }))

    try {
      await settingsService.updateOrgSettings(user.companyId, newChannels)
    } catch (error) {
      console.error(error)
      setSettings((prev) => ({ ...prev, notificationChannels: prevChannels }))
      toast.error('Erro ao salvar configurações do canal')
    }
  }

  const updateTemplate = (
    eventType: NotificationEventType,
    channel: NotificationChannelType | 'DEFAULT',
    content: string,
    subject: string | undefined,
    enabled: boolean,
  ) => {
    // Legacy method kept for store compatibility if used elsewhere,
    // but UI now uses templateService directly.
    console.warn(
      'Deprecated: updateTemplate called in store, use templateService',
    )
  }

  const updateBranding = async (branding: Partial<BrandingSettings>) => {
    if (!user) return
    const newBranding = { ...settings.branding, ...branding }
    setSettings({
      ...settings,
      branding: newBranding,
    })

    // Save to DB
    try {
      await settingsService.updateOrgSettings(
        user.companyId,
        settings.notificationChannels,
        newBranding,
      )
    } catch (e) {
      console.error('Failed to save branding', e)
      toast.error('Erro ao salvar identidade visual')
    }
  }

  const getEffectiveTemplate = (
    eventType: NotificationEventType,
    channel: NotificationChannelType,
  ): NotificationTemplate | undefined => {
    // In a real app we would load from DB.
    // For now we use the loaded templates in settings if we fetched them, or defaults
    // But we aren't fetching ALL templates into settings store anymore, we use templateService in the UI component
    // This is used by the notification store for simulation
    return undefined
  }

  const testChannel = async (
    type: NotificationChannelType,
    recipient: string,
  ) => {
    if (!user) return
    try {
      await settingsService.testNotification(type, recipient, user.companyId)
      toast.success(`Teste de envio para ${type} iniciado com sucesso`)
    } catch (e: any) {
      toast.error(`Erro no teste: ${e.message}`)
      throw e
    }
  }

  return (
    <SettingsContext.Provider
      value={{
        settings,
        loading,
        updateSettings,
        updateChannelConfig,
        updateTemplate,
        updateBranding,
        getEffectiveTemplate,
        testChannel,
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

const useSettingsStore = () => {
  const context = useContext(SettingsContext)
  if (!context)
    throw new Error('useSettingsStore must be used within SettingsProvider')
  return context
}

export default useSettingsStore
