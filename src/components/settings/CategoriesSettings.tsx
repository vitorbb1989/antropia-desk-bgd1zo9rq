import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Pencil, Trash2, Clock, Tag } from 'lucide-react'
import useCategoryStore from '@/stores/useCategoryStore'
import { TicketCategory } from '@/types'

const formSchema = z.object({
  name: z.string().min(2, 'Nome muito curto'),
  description: z.string().min(5, 'Descrição muito curta'),
  slaHours: z.coerce.number().min(1, 'SLA deve ser pelo menos 1 hora'),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Cor inválida (Use Hex)'),
  slug: z.string().min(2, 'Slug muito curto'),
})

export function CategoriesSettings() {
  const { categories, addCategory, updateCategory, removeCategory } =
    useCategoryStore()
  const [isOpen, setIsOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      slaHours: 24,
      color: '#000000',
      slug: '',
    },
  })

  const handleEdit = (category: TicketCategory) => {
    setEditingId(category.id)
    form.reset({
      name: category.name,
      description: category.description,
      slaHours: category.slaHours,
      color: category.color,
      slug: category.slug,
    })
    setIsOpen(true)
  }

  const handleAddNew = () => {
    setEditingId(null)
    form.reset({
      name: '',
      description: '',
      slaHours: 24,
      color: '#3b82f6',
      slug: '',
    })
    setIsOpen(true)
  }

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (editingId) {
      await updateCategory(editingId, values)
    } else {
      await addCategory(values)
    }
    setIsOpen(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-medium">Categorias de Chamados</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie os tipos de chamados e seus respectivos SLAs (Service Level
            Agreements).
          </p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAddNew} className="gap-2">
              <Plus className="h-4 w-4" /> Nova Categoria
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {editingId ? 'Editar Categoria' : 'Nova Categoria'}
              </DialogTitle>
              <DialogDescription>
                Defina os detalhes da categoria e o tempo de resolução esperado.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Financeiro" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Slug (Identificador)</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: financeiro" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição (Ajuda para o usuário)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Ex: Questões sobre pagamentos..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="slaHours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SLA (Horas)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="color"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cor (Hex)</FormLabel>
                        <div className="flex gap-2">
                          <FormControl>
                            <Input
                              type="color"
                              className="w-12 p-1 h-9"
                              {...field}
                            />
                          </FormControl>
                          <Input
                            {...field}
                            className="font-mono uppercase"
                            maxLength={7}
                          />
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex justify-end pt-4">
                  <Button type="submit">Salvar</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>SLA</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="w-[100px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((cat) => (
              <TableRow key={cat.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="font-medium">{cat.name}</span>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {cat.slug}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-xs font-medium bg-secondary/50 px-2 py-1 rounded w-fit">
                    <Clock className="h-3 w-3" />
                    {cat.slaHours}h
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm max-w-[300px] truncate">
                  {cat.description}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(cat)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        if (
                          confirm(
                            'Tem certeza? Tickets existentes nesta categoria podem ficar órfãos e a categoria será removida de todos os serviços contratados vinculados.',
                          )
                        ) {
                          removeCategory(cat.id)
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {categories.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  Nenhuma categoria cadastrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
