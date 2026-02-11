import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from 'react'
import { DashboardPreferences } from '@/types'
import { dashboardService } from '@/services/dashboardService'
import useAuthStore from './useAuthStore'
import { toast } from 'sonner'

interface DashboardContextType {
  preferences: DashboardPreferences
  loading: boolean
  isCustomizing: boolean
  setCustomizing: (state: boolean) => void
  toggleWidget: (widgetId: string) => Promise<void>
  isWidgetVisible: (widgetId: string) => boolean
}

const DEFAULT_WIDGETS = [
  'metrics_cards',
  'chart_trends',
  'chart_category',
  'chart_status',
  'chart_agents',
  'queue_priority',
]

const DashboardContext = createContext<DashboardContextType | null>(null)

export function DashboardProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthStore()
  const [preferences, setPreferences] = useState<DashboardPreferences>({
    userId: '',
    visibleWidgets: DEFAULT_WIDGETS,
    updatedAt: '',
  })
  const [loading, setLoading] = useState(false)
  const [isCustomizing, setCustomizing] = useState(false)

  useEffect(() => {
    if (user) {
      setLoading(true)
      dashboardService
        .getPreferences(user.id)
        .then((prefs) => {
          if (prefs) {
            setPreferences(prefs)
          } else {
            setPreferences({
              userId: user.id,
              visibleWidgets: DEFAULT_WIDGETS,
              updatedAt: new Date().toISOString(),
            })
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false))
    }
  }, [user])

  const isWidgetVisible = (widgetId: string) => {
    return preferences.visibleWidgets.includes(widgetId)
  }

  const toggleWidget = async (widgetId: string) => {
    if (!user) return

    const current = preferences.visibleWidgets
    const isVisible = current.includes(widgetId)
    const newWidgets = isVisible
      ? current.filter((w) => w !== widgetId)
      : [...current, widgetId]

    const newPrefs = {
      ...preferences,
      userId: user.id,
      visibleWidgets: newWidgets,
    }

    setPreferences(newPrefs)

    try {
      await dashboardService.savePreferences(newPrefs)
    } catch (error) {
      toast.error('Erro ao salvar preferência de dashboard')
      setPreferences(preferences) // revert
    }
  }

  return (
    <DashboardContext.Provider
      value={{
        preferences,
        loading,
        isCustomizing,
        setCustomizing,
        toggleWidget,
        isWidgetVisible,
      }}
    >
      {children}
    </DashboardContext.Provider>
  )
}

export const useDashboardStore = () => {
  const context = useContext(DashboardContext)
  if (!context)
    throw new Error('useDashboardStore must be used within DashboardProvider')
  return context
}
