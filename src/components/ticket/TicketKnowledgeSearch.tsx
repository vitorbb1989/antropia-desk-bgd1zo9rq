import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Search,
  BookOpen,
  ExternalLink,
  Copy,
  ChevronRight,
} from 'lucide-react'
import useKnowledgeStore from '@/stores/useKnowledgeStore'
import { cn } from '@/lib/utils'

interface TicketKnowledgeSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onInsert: (text: string) => void
}

export function TicketKnowledgeSearch({
  open,
  onOpenChange,
  onInsert,
}: TicketKnowledgeSearchProps) {
  const { articles } = useKnowledgeStore()
  const [search, setSearch] = useState('')
  const [selectedArticle, setSelectedArticle] = useState<string | null>(null)

  const filteredArticles = articles.filter((article) => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      article.title.toLowerCase().includes(searchLower) ||
      article.content.toLowerCase().includes(searchLower) ||
      article.tags.some((tag) => tag.toLowerCase().includes(searchLower))
    )
  })

  const handleInsert = (content: string) => {
    onInsert(content)
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px] flex flex-col p-0">
        <SheetHeader className="p-6 border-b border-border/40">
          <SheetTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Base de Conhecimento
          </SheetTitle>
          <SheetDescription>
            Pesquise artigos e insira respostas rápidas no chamado.
          </SheetDescription>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar solução..."
              className="pl-9 rounded-full bg-secondary/30 border-transparent focus:bg-white transition-colors"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 p-6">
          <div className="space-y-4">
            {filteredArticles.map((article) => (
              <Card
                key={article.id}
                className="group border shadow-sm hover:shadow-md transition-all"
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors">
                      {article.title}
                    </CardTitle>
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {article.categoryId}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-2 space-y-3">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {article.content}
                  </p>

                  <div className="flex items-center justify-between pt-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1.5 text-xs"
                        >
                          <ExternalLink className="h-3 w-3" /> Ler Artigo
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="text-xl mb-2">
                            {article.title}
                          </DialogTitle>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">{article.categoryId}</Badge>
                            {article.tags.map((tag) => (
                              <Badge
                                key={tag}
                                variant="secondary"
                                className="text-xs"
                              >
                                #{tag}
                              </Badge>
                            ))}
                          </div>
                        </DialogHeader>
                        <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90 mt-4">
                          {article.content}
                        </div>
                        <div className="flex justify-end pt-4">
                          <Button onClick={() => handleInsert(article.content)}>
                            <Copy className="mr-2 h-4 w-4" /> Inserir na
                            Resposta
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Button
                      size="sm"
                      className="h-8 gap-1.5 text-xs bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground shadow-none"
                      onClick={() => handleInsert(article.content)}
                    >
                      <Copy className="h-3 w-3" /> Inserir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredArticles.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p>Nenhum artigo encontrado.</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
