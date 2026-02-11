import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import useKnowledgeStore from '@/stores/useKnowledgeStore'
import useAuthStore from '@/stores/useAuthStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { ArrowLeft, Check, ChevronsUpDown } from 'lucide-react'
import { VersionHistory } from '@/components/knowledge/VersionHistory'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

const formSchema = z.object({
  title: z
    .string()
    .min(5, { message: 'O título deve ter pelo menos 5 caracteres.' }),
  categoryId: z.string().min(1, { message: 'Selecione uma categoria.' }),
  content: z
    .string()
    .min(20, { message: 'O conteúdo deve ter pelo menos 20 caracteres.' }),
})

export default function ArticleEditor() {
  const { articleId } = useParams()
  const navigate = useNavigate()
  const {
    articles,
    addArticle,
    updateArticle,
    categories,
    tags,
    addTag,
    canPerform,
  } = useKnowledgeStore()
  const { user } = useAuthStore()
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [tagOpen, setTagOpen] = useState(false)
  const [tagSearch, setTagSearch] = useState('')

  const isEditing = !!articleId
  const existingArticle = articles.find((a) => a.id === articleId)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      categoryId: '',
      content: '',
    },
  })

  // Load existing data
  useEffect(() => {
    if (isEditing && existingArticle) {
      form.reset({
        title: existingArticle.title,
        categoryId: existingArticle.categoryId,
        content: existingArticle.content,
      })
      setSelectedTags(existingArticle.tags)
    }
  }, [isEditing, existingArticle, form])

  // Guard: Check permissions
  if (!user || !canPerform(user.role, 'edit')) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
        <h2 className="text-xl font-semibold">Acesso Negado</h2>
        <p className="text-muted-foreground">
          Você não tem permissão para criar ou editar artigos.
        </p>
        <Button onClick={() => navigate('/knowledge-base')}>Voltar</Button>
      </div>
    )
  }

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) return

    if (isEditing && articleId) {
      updateArticle(
        articleId,
        {
          title: values.title,
          categoryId: values.categoryId,
          content: values.content,
          tags: selectedTags,
          authorId: user.id,
        },
        user.id,
      )
      toast.success('Artigo atualizado com sucesso')
      navigate(`/knowledge-base/${articleId}`)
    } else {
      addArticle({
        title: values.title,
        categoryId: values.categoryId,
        content: values.content,
        tags: selectedTags,
        authorId: user.id,
      })
      toast.success('Artigo criado com sucesso')
      navigate('/knowledge-base')
    }
  }

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )
  }

  const handleCreateTag = () => {
    if (tagSearch.trim()) {
      const newTag = tagSearch.trim()
      addTag(newTag)
      if (!selectedTags.includes(newTag)) {
        setSelectedTags((prev) => [...prev, newTag])
      }
      setTagSearch('')
    }
  }

  const parentCategories = categories.filter((c) => !c.parentId)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              navigate(
                isEditing ? `/knowledge-base/${articleId}` : '/knowledge-base',
              )
            }
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEditing ? 'Editar Artigo' : 'Novo Artigo'}
          </h1>
        </div>
        {isEditing && articleId && <VersionHistory articleId={articleId} />}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Conteúdo do Artigo</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: Como configurar a impressora"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma categoria" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {parentCategories.map((parent) => (
                            <div key={parent.id}>
                              <SelectItem
                                value={parent.id}
                                className="font-semibold"
                              >
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
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormItem className="flex flex-col">
                  <FormLabel>Tags</FormLabel>
                  <Popover open={tagOpen} onOpenChange={setTagOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={tagOpen}
                        className="justify-between"
                      >
                        {selectedTags.length > 0
                          ? `${selectedTags.length} tags selecionadas`
                          : 'Selecione tags...'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0">
                      <Command>
                        <CommandInput
                          placeholder="Buscar tag..."
                          onValueChange={setTagSearch}
                        />
                        <CommandList>
                          <CommandEmpty className="p-2">
                            <Button
                              variant="ghost"
                              className="w-full justify-start text-xs"
                              onClick={handleCreateTag}
                            >
                              Criar tag "{tagSearch}"
                            </Button>
                          </CommandEmpty>
                          <CommandGroup>
                            {tags.map((tag) => (
                              <CommandItem
                                key={tag}
                                value={tag}
                                onSelect={() => toggleTag(tag)}
                              >
                                <Check
                                  className={cn(
                                    'mr-2 h-4 w-4',
                                    selectedTags.includes(tag)
                                      ? 'opacity-100'
                                      : 'opacity-0',
                                  )}
                                />
                                {tag}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedTags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                        <span
                          className="ml-1 cursor-pointer hover:text-destructive"
                          onClick={() => toggleTag(tag)}
                        >
                          ×
                        </span>
                      </Badge>
                    ))}
                  </div>
                </FormItem>
              </div>

              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conteúdo</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Escreva os detalhes do artigo aqui..."
                        className="min-h-[300px] font-sans"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Use uma linguagem clara e objetiva.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/knowledge-base')}
                >
                  Cancelar
                </Button>
                <Button type="submit">
                  {isEditing ? 'Salvar Alterações' : 'Publicar Artigo'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
