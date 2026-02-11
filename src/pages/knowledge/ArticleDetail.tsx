import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import useKnowledgeStore from '@/stores/useKnowledgeStore'
import useAuthStore from '@/stores/useAuthStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  ArrowLeft,
  Edit,
  Calendar,
  User as UserIcon,
  Tag,
  Trash2,
  Folder,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { VersionHistory } from '@/components/knowledge/VersionHistory'

export default function ArticleDetail() {
  const { articleId } = useParams()
  const navigate = useNavigate()
  const { articles, deleteArticle, canPerform, getCategoryPath } =
    useKnowledgeStore()
  const { users, user } = useAuthStore()

  // Guard: View Permission
  if (!user || !canPerform(user.role, 'view')) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
        <h2 className="text-xl font-semibold">Acesso Negado</h2>
        <Button onClick={() => navigate('/')}>Voltar</Button>
      </div>
    )
  }

  const article = articles.find((a) => a.id === articleId)

  if (!article) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
        <h2 className="text-xl font-semibold">Artigo não encontrado</h2>
        <Button onClick={() => navigate('/knowledge-base')}>
          Voltar para a Base
        </Button>
      </div>
    )
  }

  const author = users.find((u) => u.id === article.authorId)

  const handleDelete = () => {
    deleteArticle(article.id)
    toast.success('Artigo excluído com sucesso')
    navigate('/knowledge-base')
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          className="text-muted-foreground hover:text-foreground pl-0 gap-2"
          onClick={() => navigate('/knowledge-base')}
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <div className="flex gap-2">
          {canPerform(user.role, 'edit') && (
            <VersionHistory articleId={article.id} />
          )}

          {canPerform(user.role, 'delete') && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
                >
                  <Trash2 className="h-4 w-4" /> Excluir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. Isso excluirá
                    permanentemente o artigo da base de conhecimento.
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
          )}

          {canPerform(user.role, 'edit') && (
            <Button variant="outline" className="gap-2" asChild>
              <Link to={`/knowledge-base/${article.id}/edit`}>
                <Edit className="h-4 w-4" /> Editar Artigo
              </Link>
            </Button>
          )}
        </div>
      </div>

      <article className="space-y-8">
        <div className="space-y-4">
          <div className="flex gap-2 text-sm text-muted-foreground items-center">
            <Folder className="h-4 w-4" />
            <span>{getCategoryPath(article.categoryId)}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground leading-tight">
            {article.title}
          </h1>

          <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground border-b border-border/40 pb-6">
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={author?.avatar} />
                <AvatarFallback>
                  <UserIcon className="h-3 w-3" />
                </AvatarFallback>
              </Avatar>
              <span className="font-medium text-foreground">
                {author?.name || 'Desconhecido'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>
                Atualizado em{' '}
                {format(new Date(article.updatedAt), "d 'de' MMMM, yyyy", {
                  locale: ptBR,
                })}
              </span>
            </div>
          </div>
        </div>

        <Card className="border-0 shadow-none bg-transparent">
          <CardContent className="p-0 text-base leading-7 text-foreground/90 whitespace-pre-wrap font-sans">
            {article.content}
          </CardContent>
        </Card>

        {article.tags.length > 0 && (
          <div className="pt-6 border-t border-border/40">
            <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground">
              <Tag className="h-4 w-4" /> Tags Relacionadas
            </div>
            <div className="flex flex-wrap gap-2">
              {article.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="text-muted-foreground"
                >
                  #{tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </article>
    </div>
  )
}
