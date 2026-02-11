import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
} from 'react'
import { Workflow } from '@/types'
import { workflowService } from '@/services/workflowService'
import useAuthStore from './useAuthStore'
import { toast } from 'sonner'

interface WorkflowContextType {
  workflows: Workflow[]
  loading: boolean
  fetchWorkflows: () => Promise<void>
  saveWorkflow: (workflow: Partial<Workflow>) => Promise<void>
  deleteWorkflow: (id: string) => Promise<void>
  toggleWorkflow: (id: string, isActive: boolean) => Promise<void>
}

const WorkflowContext = createContext<WorkflowContextType | null>(null)

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthStore()
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(false)

  const fetchWorkflows = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const data = await workflowService.getWorkflows(user.companyId)
      setWorkflows(data)
    } catch (e) {
      toast.error('Erro ao carregar workflows')
    } finally {
      setLoading(false)
    }
  }, [user])

  const saveWorkflow = async (workflow: Partial<Workflow>) => {
    if (!user) return
    try {
      if (workflow.id) {
        await workflowService.updateWorkflow(workflow.id, workflow)
        toast.success('Workflow atualizado')
      } else {
        await workflowService.createWorkflow({
          ...workflow,
          organizationId: user.companyId,
        })
        toast.success('Workflow criado')
      }
      await fetchWorkflows()
    } catch (e) {
      toast.error('Erro ao salvar workflow')
    }
  }

  const deleteWorkflow = async (id: string) => {
    try {
      await workflowService.deleteWorkflow(id)
      setWorkflows((prev) => prev.filter((w) => w.id !== id))
      toast.success('Workflow excluído')
    } catch (e) {
      toast.error('Erro ao excluir workflow')
    }
  }

  const toggleWorkflow = async (id: string, isActive: boolean) => {
    try {
      await workflowService.updateWorkflow(id, { isActive })
      setWorkflows((prev) =>
        prev.map((w) => (w.id === id ? { ...w, isActive } : w)),
      )
      toast.success(`Workflow ${isActive ? 'ativado' : 'desativado'}`)
    } catch (e) {
      toast.error('Erro ao atualizar status')
    }
  }

  return (
    <WorkflowContext.Provider
      value={{
        workflows,
        loading,
        fetchWorkflows,
        saveWorkflow,
        deleteWorkflow,
        toggleWorkflow,
      }}
    >
      {children}
    </WorkflowContext.Provider>
  )
}

export const useWorkflowStore = () => {
  const context = useContext(WorkflowContext)
  if (!context)
    throw new Error('useWorkflowStore must be used within WorkflowProvider')
  return context
}
