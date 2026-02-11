import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from 'react'
import { UserPreference } from '@/types'
import useAuthStore from './useAuthStore'
import { settingsService } from '@/services/settingsService'
import { toast } from 'sonner'

interface UserPreferencesContextType {
  preferences: UserPreference | null
  loading: boolean
  savePreferences: (newPreferences: UserPreference) => Promise<void>
}

const UserPreferencesContext = createContext<UserPreferencesContextType | null>(
  null,
)

export function UserPreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthStore()
  const [preferences, setPreferences] = useState<UserPreference | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function loadPrefs() {
      if (user) {
        setLoading(true)
        try {
          const prefs = await settingsService.getUserPreferences(user.id)
          if (prefs) {
            setPreferences(prefs)
          } else {
            // Default init
            const newPref: UserPreference = {
              userId: user.id,
              channels: { email: true, whatsapp: false, sms: false },
              contactInfo: { email: user.email, phoneNumber: '' },
              events: {
                ticketCreated: true,
                ticketAssigned: true,
                newMessage: true,
                ticketClosed: true,
                mention: true,
                newAttachment: true,
                statusUpdated: true,
              },
              quietHours: { enabled: false, start: '22:00', end: '08:00' },
              summaryMode: 'IMMEDIATE',
            }
            setPreferences(newPref)
          }
        } catch (error) {
          console.error(error)
          toast.error('Erro ao carregar preferências')
        } finally {
          setLoading(false)
        }
      } else {
        setPreferences(null)
      }
    }
    loadPrefs()
  }, [user])

  const savePreferences = async (newPreferences: UserPreference) => {
    if (!user) return

    const prevPreferences = preferences
    setLoading(true)
    try {
      // Optimistic update
      setPreferences(newPreferences)

      await settingsService.saveUserPreferences({
        ...newPreferences,
        userId: user.id,
        contactInfo: {
          ...newPreferences.contactInfo,
          email: newPreferences.contactInfo.email || user.email,
        },
      }, user.companyId)
      toast.success('Preferências salvas com sucesso!')
    } catch (error) {
      console.error(error)
      setPreferences(prevPreferences)
      toast.error('Erro ao salvar preferências')
    } finally {
      setLoading(false)
    }
  }

  return (
    <UserPreferencesContext.Provider
      value={{
        preferences,
        loading,
        savePreferences,
      }}
    >
      {children}
    </UserPreferencesContext.Provider>
  )
}

const useUserPreferencesStore = () => {
  const context = useContext(UserPreferencesContext)
  if (!context)
    throw new Error(
      'useUserPreferencesStore must be used within UserPreferencesProvider',
    )
  return context
}

export default useUserPreferencesStore
