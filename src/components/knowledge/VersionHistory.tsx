import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { History, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import useKnowledgeStore from '@/stores/useKnowledgeStore'
import useAuthStore from '@/stores/useAuthStore'
import { ArticleVersion } from '@/types'
import { toast } from 'sonner'
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

interface VersionHistoryProps {
  articleId: string
}

export function VersionHistory({ articleId }: VersionHistoryProps) {
  const { getArticleVersions, restoreVersion } = useKnowledgeStore()
  const { users, user: currentUser } = useAuthStore()

  const versions = getArticleVersions(articleId)

  const handleRestore = (version: ArticleVersion) => {
    if (!currentUser) return
    restoreVersion(version, currentUser.id)
    toast.success('Versão restaurada com sucesso')
  }

  const getEditorName = (editorId: string) => {
    return users.find((u) => u.id === editorId)?.name || 'Usuário desconhecido'
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <History className="h-4 w-4" />
          Histórico
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Histórico de Versões</SheetTitle>
          <SheetDescription>
            Visualize e restaure versões anteriores deste artigo.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-8rem)] mt-6 pr-4">
          <div className="space-y-4">
            {versions.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                Nenhuma versão anterior encontrada.
              </div>
            )}
            {versions.map((version) => (
              <div
                key={version.id}
                className="flex flex-col gap-2 rounded-lg border p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium">
                    {format(new Date(version.updatedAt), "d 'de' MMMM, HH:mm", {
                      locale: ptBR,
                    })}
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                        <RotateCcw className="h-4 w-4 text-primary" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Restaurar esta versão?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          O conteúdo atual será substituído pelo conteúdo desta
                          versão. Uma nova versão será criada com o conteúdo
                          atual antes da restauração.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRestore(version)}
                        >
                          Confirmar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                <div className="text-sm text-muted-foreground">
                  Editado por:{' '}
                  <span className="text-foreground">
                    {getEditorName(version.editorId)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground bg-muted p-2 rounded mt-2 line-clamp-2 font-mono">
                  {version.content}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
