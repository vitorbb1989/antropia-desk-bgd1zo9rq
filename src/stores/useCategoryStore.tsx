import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useCallback,
} from 'react'
import { TicketCategory } from '@/types'
import { categoryService } from '@/services/categoryService'
import useAuthStore from './useAuthStore'
import { toast } from 'sonner'

interface CategoryContextType {
  categories: TicketCategory[]
  loading: boolean
  fetchCategories: () => Promise<void>
  addCategory: (
    category: Omit<
      TicketCategory,
      'id' | 'createdAt' | 'updatedAt' | 'organizationId'
    >,
  ) => Promise<void>
  updateCategory: (
    id: string,
    updates: Partial<
      Omit<TicketCategory, 'id' | 'organizationId' | 'createdAt'>
    >,
  ) => Promise<void>
  removeCategory: (id: string) => Promise<void>
  getCategoryById: (id: string) => TicketCategory | undefined
}

const CategoryContext = createContext<CategoryContextType | null>(null)

export function CategoryProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<TicketCategory[]>([])
  const [loading, setLoading] = useState(false)
  const { user } = useAuthStore()

  const fetchCategories = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const data = await categoryService.getCategories(user.companyId)
      setCategories(data)
    } catch (error) {
      console.error('Failed to fetch categories:', error)
      toast.error('Erro ao carregar categorias')
    } finally {
      setLoading(false)
    }
  }, [user])

  // Initial Fetch
  useEffect(() => {
    if (user) {
      fetchCategories()
    }
  }, [user, fetchCategories])

  const addCategory = async (
    categoryData: Omit<
      TicketCategory,
      'id' | 'createdAt' | 'updatedAt' | 'organizationId'
    >,
  ) => {
    if (!user) return
    try {
      const newCategory = await categoryService.createCategory({
        ...categoryData,
        organizationId: user.companyId,
      })
      setCategories((prev) =>
        [...prev, newCategory].sort((a, b) => a.name.localeCompare(b.name)),
      )
      toast.success('Categoria criada com sucesso')
    } catch (error) {
      console.error('Failed to create category:', error)
      toast.error('Erro ao criar categoria')
    }
  }

  const updateCategory = async (
    id: string,
    updates: Partial<
      Omit<TicketCategory, 'id' | 'organizationId' | 'createdAt'>
    >,
  ) => {
    try {
      const updated = await categoryService.updateCategory(id, updates)
      setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)))
      toast.success('Categoria atualizada com sucesso')
    } catch (error) {
      console.error('Failed to update category:', error)
      toast.error('Erro ao atualizar categoria')
    }
  }

  const removeCategory = async (id: string) => {
    try {
      await categoryService.deleteCategory(id)
      setCategories((prev) => prev.filter((c) => c.id !== id))
      toast.success('Categoria removida')
    } catch (error) {
      console.error('Failed to delete category:', error)
      toast.error('Erro ao remover categoria')
    }
  }

  const getCategoryById = (id: string) => categories.find((c) => c.id === id)

  return (
    <CategoryContext.Provider
      value={{
        categories,
        loading,
        fetchCategories,
        addCategory,
        updateCategory,
        removeCategory,
        getCategoryById,
      }}
    >
      {children}
    </CategoryContext.Provider>
  )
}

const useCategoryStore = () => {
  const context = useContext(CategoryContext)
  if (!context)
    throw new Error('useCategoryStore must be used within CategoryProvider')
  return context
}

export default useCategoryStore
