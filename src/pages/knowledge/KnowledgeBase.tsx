import { useState } from 'react'
import useKnowledgeStore from '@/stores/useKnowledgeStore'
import useAuthStore from '@/stores/useAuthStore'
import { Link, useNavigate } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Search,
  BookOpen,
  Plus,
  ChevronRight,
  MoreVertical,
  Trash2,
  Edit,
  FolderOpen,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { KBSettings } from '@/components/knowledge/KBSettings'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

export default function KnowledgeBase() {
  const {
    articles,
    categories,
    deleteArticle,
    canPerform,
    getCategoryPath,
    tags,
    fetchArticles,
    loading,
    totalArticles,
    page,
    setPage,
    page: currentPage,
    // Note: totalArticles and pageSize needed to calc pages
  } = useKnowledgeStore()
  const { user } = useAuthStore()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const navigate = useNavigate()

  // Trigger search when user types or changes filter
  const handleSearch = () => {
    fetchArticles(search, categoryFilter)
  }

  // Guard: Check View Permission
  if (!user || !canPerform(user.role, 'view')) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
        <h2 className="text-xl font-semibold">Acesso Restrito</h2>
        <p className="text-muted-foreground">
          Você não tem permissão para visualizar a base de conhecimento.
        </p>
        <Button onClick={() => navigate('/')}>Voltar ao Início</Button>
      </div>
    )
  }

  const handleDelete = () => {
    if (deleteId) {
      deleteArticle(deleteId)
      setDeleteId(null)
      toast.success('Artigo excluído com sucesso')
    }
  }

  const ArticleCard = ({ article }: { article: any }) => (
    <Card className="h-full hover:shadow-md transition-all border-l-0 hover:border-l-4 hover:border-l-primary duration-200 relative group flex flex-col">
      <CardHeader className="pr-12 pb-4">
        <Link to={`/knowledge-base/${article.id}`} className="block">
          <div className="flex items-center gap-2 mb-2">
            <Badge
              variant="outline"
              className="text-[10px] font-normal text-muted-foreground"
            >
              {getCategoryPath(article.categoryId)}
            </Badge>
          </div>
          <CardTitle className="text-base group-hover:text-primary transition-colors line-clamp-2">
            {article.title}
          </CardTitle>
          <CardDescription className="line-clamp-2 mt-2 text-sm">
            {article.content}
          </CardDescription>
        </Link>
        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
          {(canPerform(user.role, 'edit') ||
            canPerform(user.role, 'delete')) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canPerform(user.role, 'edit') && (
                  <DropdownMenuItem
                    onClick={() =>
                      navigate(`/knowledge-base/${article.id}/edit`)
                    }
                  >
                    <Edit className="mr-2 h-4 w-4" /> Editar
                  </DropdownMenuItem>
                )}
                {canPerform(user.role, 'delete') && (
                  <DropdownMenuItem
                    onClick={() => setDeleteId(article.id)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Excluir
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
      <CardContent className="mt-auto pt-0">
        <Link to={`/knowledge-base/${article.id}`} className="block">
          <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-4">
            <span>
              {format(new Date(article.updatedAt), 'd MMM, yyyy', {
                locale: ptBR,
              })}
            </span>
            <div className="flex gap-2 items-center">
              <ChevronRight className="h-4 w-4 opacity-50" />
            </div>
          </div>
        </Link>
      </CardContent>
    </Card>
  )

  const parentCategories = categories.filter((c) => !c.parentId)
  const totalPages = Math.ceil(totalArticles / 20)

  return (
    <div className="space-y-8 max-w-6xl mx-auto p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-primary" />
            Base de Conhecimento
          </h1>
          <p className="text-muted-foreground mt-2">
            Central de documentação e ajuda técnica.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canPerform(user.role, 'edit') && (
            <Button asChild className="rounded-full shadow-lg">
              <Link to="/knowledge-base/new">
                <Plus className="mr-2 h-4 w-4" /> Novo Artigo
              </Link>
            </Button>
          )}
          {user.role === 'ADMIN' && <KBSettings />}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-3 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Pesquisar artigos..."
            className="pl-12 h-11 rounded-full bg-white shadow-sm border-gray-200"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Select
            value={categoryFilter}
            onValueChange={(val) => {
              setCategoryFilter(val)
              fetchArticles(search, val)
            }}
          >
            <SelectTrigger className="w-full md:w-[200px] h-11 rounded-full bg-white">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Categorias</SelectItem>
              {parentCategories.map((parent) => (
                <div key={parent.id}>
                  <SelectItem value={parent.id} className="font-semibold">
                    {parent.name}
                  </SelectItem>
                  {categories
                    .filter((c) => c.parentId === parent.id)
                    .map((child) => (
                      <SelectItem
                        key={child.id}
                        value={child.id}
                        className="pl-6 text-muted-foreground"
                      >
                        ↳ {child.name}
                      </SelectItem>
                    ))}
                </div>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={handleSearch}
            variant="secondary"
            className="rounded-full px-6"
          >
            Buscar
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="min-h-[300px]">
        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-48 rounded-xl border bg-card p-6 flex flex-col gap-4"
              >
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <div className="mt-auto flex justify-between items-center">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-6 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : articles.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white/50 rounded-2xl border border-dashed flex flex-col items-center justify-center">
            <FolderOpen className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium">Nenhum artigo encontrado</h3>
            <p className="text-muted-foreground max-w-sm mt-2">
              Tente ajustar os filtros ou criar um novo artigo para a base de
              conhecimento.
            </p>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <Pagination className="justify-center">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setPage(Math.max(1, currentPage - 1))}
                className={
                  currentPage === 1
                    ? 'pointer-events-none opacity-50'
                    : 'cursor-pointer'
                }
              />
            </PaginationItem>
            <PaginationItem>
              <span className="text-sm text-muted-foreground px-4">
                {currentPage} de {totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                className={
                  currentPage === totalPages
                    ? 'pointer-events-none opacity-50'
                    : 'cursor-pointer'
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso excluirá permanentemente o
              artigo da base de conhecimento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
