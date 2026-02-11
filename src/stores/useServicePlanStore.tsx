import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useCallback,
} from 'react'
import type { ServicePlan, UserServiceCategory } from '@/types'
import { servicePlanService } from '@/services/servicePlanService'
import useAuthStore from './useAuthStore'

interface ServicePlanContextType {
  /** All active service plans for the organization */
  servicePlans: ServicePlan[]
  /** Categories available to the current user (based on their service plans) */
  userCategories: UserServiceCategory[]
  loading: boolean
  fetchServicePlans: () => Promise<void>
  fetchUserCategories: () => Promise<void>
  getUserServicePlanIds: (userId: string) => Promise<string[]>
  assignServicePlans: (userId: string, planIds: string[]) => Promise<void>
}

const ServicePlanContext = createContext<ServicePlanContextType | null>(null)

export function ServicePlanProvider({ children }: { children: ReactNode }) {
  const [servicePlans, setServicePlans] = useState<ServicePlan[]>([])
  const [userCategories, setUserCategories] = useState<UserServiceCategory[]>([])
  const [loading, setLoading] = useState(false)
  const { user } = useAuthStore()

  const fetchServicePlans = useCallback(async () => {
    if (!user) return
    try {
      const data = await servicePlanService.getServicePlans(user.companyId)
      setServicePlans(data)
    } catch (error) {
      console.error('Failed to fetch service plans:', error)
    }
  }, [user])

  const fetchUserCategories = useCallback(async () => {
    if (!user || user.role !== 'USER') return
    setLoading(true)
    try {
      const data = await servicePlanService.getUserCategories(user.id)
      setUserCategories(data)
    } catch (error) {
      console.error('Failed to fetch user categories:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  const getUserServicePlanIds = useCallback(async (userId: string) => {
    return servicePlanService.getUserServicePlanIds(userId)
  }, [])

  const assignServicePlans = useCallback(async (userId: string, planIds: string[]) => {
    await servicePlanService.assignServicePlans(userId, planIds)
  }, [])

  useEffect(() => {
    if (user) {
      fetchServicePlans()
      if (user.role === 'USER') {
        fetchUserCategories()
      }
    } else {
      setServicePlans([])
      setUserCategories([])
    }
  }, [user, fetchServicePlans, fetchUserCategories])

  return (
    <ServicePlanContext.Provider
      value={{
        servicePlans,
        userCategories,
        loading,
        fetchServicePlans,
        fetchUserCategories,
        getUserServicePlanIds,
        assignServicePlans,
      }}
    >
      {children}
    </ServicePlanContext.Provider>
  )
}

const useServicePlanStore = () => {
  const context = useContext(ServicePlanContext)
  if (!context)
    throw new Error('useServicePlanStore must be used within ServicePlanProvider')
  return context
}

export default useServicePlanStore
