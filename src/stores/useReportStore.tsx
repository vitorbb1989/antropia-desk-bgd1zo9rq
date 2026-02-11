import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
} from 'react'
import { ReportTemplate } from '@/types'
import { reportService } from '@/services/reportService'
import useAuthStore from './useAuthStore'
import { toast } from 'sonner'

interface ReportContextType {
  templates: ReportTemplate[]
  loading: boolean
  fetchTemplates: () => Promise<void>
  addTemplate: (
    template: Omit<
      ReportTemplate,
      'id' | 'createdAt' | 'updatedAt' | 'lastSentAt'
    >,
  ) => Promise<void>
  updateTemplate: (
    id: string,
    updates: Partial<ReportTemplate>,
  ) => Promise<void>
  removeTemplate: (id: string) => Promise<void>
  triggerReport: (id: string) => Promise<void>
}

const ReportContext = createContext<ReportContextType | null>(null)

export function ReportProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthStore()
  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const [loading, setLoading] = useState(false)

  const fetchTemplates = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const data = await reportService.getTemplates(user.companyId)
      setTemplates(data)
    } catch (error) {
      console.error(error)
      toast.error('Erro ao carregar templates de relatório')
    } finally {
      setLoading(false)
    }
  }, [user])

  const addTemplate = async (
    data: Omit<ReportTemplate, 'id' | 'createdAt' | 'updatedAt' | 'lastSentAt'>,
  ) => {
    try {
      const newTemplate = await reportService.createTemplate(data)
      setTemplates((prev) => [newTemplate, ...prev])
      toast.success('Template criado com sucesso')
    } catch (error) {
      toast.error('Erro ao criar template')
      throw error
    }
  }

  const updateTemplate = async (
    id: string,
    updates: Partial<ReportTemplate>,
  ) => {
    try {
      await reportService.updateTemplate(id, updates)
      setTemplates((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      )
      toast.success('Template atualizado')
    } catch (error) {
      toast.error('Erro ao atualizar template')
    }
  }

  const removeTemplate = async (id: string) => {
    try {
      await reportService.deleteTemplate(id)
      setTemplates((prev) => prev.filter((t) => t.id !== id))
      toast.success('Template removido')
    } catch (error) {
      toast.error('Erro ao remover template')
    }
  }

  const triggerReport = async (id: string) => {
    try {
      await reportService.generateReport(id)
      toast.success('Geração de relatório iniciada')
    } catch (error) {
      toast.error('Erro ao gerar relatório')
    }
  }

  return (
    <ReportContext.Provider
      value={{
        templates,
        loading,
        fetchTemplates,
        addTemplate,
        updateTemplate,
        removeTemplate,
        triggerReport,
      }}
    >
      {children}
    </ReportContext.Provider>
  )
}

export const useReportStore = () => {
  const context = useContext(ReportContext)
  if (!context)
    throw new Error('useReportStore must be used within ReportProvider')
  return context
}
