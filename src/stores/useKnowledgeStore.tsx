import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
} from 'react'
import {
  Article,
  Category,
  ArticleVersion,
  KBPermission,
  UserRole,
} from '@/types'
import { kbService } from '@/services/kbService'
import useAuthStore from './useAuthStore'
import { toast } from 'sonner'

// Default permissions fallback if none in DB
const DEFAULT_PERMISSIONS: KBPermission[] = [
  { role: 'ADMIN', canView: true, canEdit: true, canDelete: true },
  { role: 'AGENT', canView: true, canEdit: true, canDelete: false },
  { role: 'USER', canView: true, canEdit: false, canDelete: false },
]

interface KnowledgeContextType {
  articles: Article[]
  categories: Category[]
  tags: string[]
  permissions: KBPermission[]
  versions: ArticleVersion[]
  loading: boolean
  totalArticles: number
  page: number
  setPage: (page: number) => void
  fetchArticles: (search?: string, categoryId?: string) => Promise<void>

  // Article Actions
  addArticle: (article: Omit<Article, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateArticle: (
    id: string,
    article: Partial<Omit<Article, 'id' | 'createdAt' | 'updatedAt'>>,
    editorId: string,
  ) => void
  deleteArticle: (id: string) => void

  // Category Actions
  addCategory: (name: string, parentId: string | null) => Promise<void> | void
  updateCategory: (id: string, name: string, parentId: string | null) => Promise<void> | void
  deleteCategory: (id: string) => Promise<void> | void
  getCategoryPath: (categoryId: string) => string

  // Tag Actions
  addTag: (tag: string) => void
  deleteTag: (tag: string) => void

  // Permission Actions
  updatePermission: (
    role: UserRole,
    permission: Partial<Omit<KBPermission, 'role'>>,
  ) => void
  canPerform: (role: UserRole, action: 'view' | 'edit' | 'delete') => boolean

  // Version Actions
  getArticleVersions: (articleId: string) => ArticleVersion[]
  restoreVersion: (version: ArticleVersion, userId: string) => void
}

const KnowledgeContext = createContext<KnowledgeContextType | null>(null)

export function KnowledgeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthStore()
  const [articles, setArticles] = useState<Article[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<string[]>([]) // Still using local for tags simplistically
  const [permissions, setPermissions] =
    useState<KBPermission[]>(DEFAULT_PERMISSIONS)
  const [versions, setVersions] = useState<ArticleVersion[]>([])

  const [loading, setLoading] = useState(false)
  const [totalArticles, setTotalArticles] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const isFetchingCategoriesRef = useRef(false)

  const fetchArticles = useCallback(
    async (search?: string, categoryId?: string) => {
      if (!user) return
      setLoading(true)
      try {
        const { data, total } = await kbService.getArticles(
          user.companyId,
          page,
          pageSize,
          search,
          categoryId,
        )
        setArticles(data)
        setTotalArticles(total)

        // Also fetch categories if empty (with race condition guard)
        if (categories.length === 0 && !isFetchingCategoriesRef.current) {
          isFetchingCategoriesRef.current = true
          try {
            const cats = await kbService.getCategories(user.companyId)
            setCategories(cats)
          } finally {
            isFetchingCategoriesRef.current = false
          }
        }
      } catch (error) {
        console.error(error)
        toast.error('Erro ao carregar base de conhecimento')
      } finally {
        setLoading(false)
      }
    },
    [user, page, pageSize, categories.length],
  )

  useEffect(() => {
    fetchArticles()
  }, [fetchArticles])

  // Article Actions
  const addArticle = async (
    data: Omit<Article, 'id' | 'createdAt' | 'updatedAt'>,
  ) => {
    if (!user) return
    try {
      const newArticle = await kbService.createArticle(data, user.companyId)
      setArticles((prev) => [newArticle, ...prev])
    } catch (e) {
      toast.error('Erro ao criar artigo')
    }
  }

  const updateArticle = async (
    id: string,
    data: Partial<Omit<Article, 'id' | 'createdAt' | 'updatedAt'>>,
    editorId: string,
  ) => {
    try {
      await kbService.updateArticle(id, data, editorId)
      setArticles((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, ...data, updatedAt: new Date().toISOString() }
            : a,
        ),
      )
      // Optimistic version update logic could be added here
    } catch (e) {
      toast.error('Erro ao atualizar artigo')
    }
  }

  const restoreVersion = (version: ArticleVersion, userId: string) => {
    updateArticle(
      version.articleId,
      {
        title: version.title,
        content: version.content,
        categoryId: version.categoryId,
        tags: version.tags,
      },
      userId,
    )
  }

  const deleteArticle = async (id: string) => {
    try {
      await kbService.deleteArticle(id)
      setArticles((prev) => prev.filter((a) => a.id !== id))
    } catch (e) {
      toast.error('Erro ao excluir artigo')
    }
  }

  // Category Actions - persisted via kbService
  const addCategory = async (name: string, parentId: string | null) => {
    if (!user) return
    try {
      const newCat = await kbService.createCategory(name, parentId, user.companyId)
      setCategories((prev) => [...prev, newCat])
    } catch (e) {
      toast.error('Erro ao criar categoria')
    }
  }

  const updateCategory = async (
    id: string,
    name: string,
    parentId: string | null,
  ) => {
    try {
      await kbService.updateCategory(id, name, parentId)
      setCategories((prev) =>
        prev.map((c) => (c.id === id ? { ...c, name, parentId } : c)),
      )
    } catch (e) {
      toast.error('Erro ao atualizar categoria')
    }
  }

  const deleteCategory = async (id: string) => {
    try {
      await kbService.deleteCategory(id)
      setCategories((prev) =>
        prev.filter((c) => c.id !== id && c.parentId !== id),
      )
    } catch (e) {
      toast.error('Erro ao excluir categoria')
    }
  }

  const getCategoryPath = (categoryId: string) => {
    const cat = categories.find((c) => c.id === categoryId)
    if (!cat) return 'Desconhecida'
    if (cat.parentId) {
      const parent = categories.find((c) => c.id === cat.parentId)
      return parent ? `${parent.name} > ${cat.name}` : cat.name
    }
    return cat.name
  }

  // Tag Actions
  const addTag = (tag: string) => {
    if (!tags.includes(tag)) setTags((prev) => [...prev, tag])
  }

  const deleteTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag))
  }

  // Permission Actions
  const updatePermission = (
    role: UserRole,
    permission: Partial<Omit<KBPermission, 'role'>>,
  ) => {
    setPermissions((prev) =>
      prev.map((p) => (p.role === role ? { ...p, ...permission } : p)),
    )
  }

  const canPerform = (role: UserRole, action: 'view' | 'edit' | 'delete') => {
    const perm = permissions.find((p) => p.role === role)
    if (!perm) return false

    switch (action) {
      case 'view':
        return perm.canView
      case 'edit':
        return perm.canEdit
      case 'delete':
        return perm.canDelete
      default:
        return false
    }
  }

  const getArticleVersions = (articleId: string) => {
    return versions
      .filter((v) => v.articleId === articleId)
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )
  }

  return (
    <KnowledgeContext.Provider
      value={{
        articles,
        categories,
        tags,
        permissions,
        versions,
        loading,
        totalArticles,
        page,
        setPage,
        fetchArticles,
        addArticle,
        updateArticle,
        deleteArticle,
        addCategory,
        updateCategory,
        deleteCategory,
        getCategoryPath,
        addTag,
        deleteTag,
        updatePermission,
        canPerform,
        getArticleVersions,
        restoreVersion,
      }}
    >
      {children}
    </KnowledgeContext.Provider>
  )
}

const useKnowledgeStore = () => {
  const context = useContext(KnowledgeContext)
  if (!context)
    throw new Error('useKnowledgeStore must be used within KnowledgeProvider')
  return context
}

export default useKnowledgeStore
