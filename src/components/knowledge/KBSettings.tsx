import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Settings2, Plus, Trash2, Tag, FolderTree, Shield } from 'lucide-react'
import useKnowledgeStore from '@/stores/useKnowledgeStore'
import { UserRole } from '@/types'
import { translateRole } from '@/utils/translations'

export function KBSettings() {
  const {
    categories,
    addCategory,
    deleteCategory,
    tags,
    addTag,
    deleteTag,
    permissions,
    updatePermission,
  } = useKnowledgeStore()

  const [newCatName, setNewCatName] = useState('')
  const [newCatParent, setNewCatParent] = useState<string | null>(null)
  const [newTag, setNewTag] = useState('')

  const handleAddCategory = () => {
    if (newCatName.trim()) {
      addCategory(newCatName, newCatParent === 'root' ? null : newCatParent)
      setNewCatName('')
      setNewCatParent(null)
    }
  }

  const handleAddTag = () => {
    if (newTag.trim()) {
      addTag(newTag.trim())
      setNewTag('')
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Settings2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurações da Base de Conhecimento</DialogTitle>
          <DialogDescription>
            Gerencie categorias, tags e permissões de acesso.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="categories" className="mt-4">
          <TabsList>
            <TabsTrigger value="categories" className="gap-2">
              <FolderTree className="h-4 w-4" /> Categorias
            </TabsTrigger>
            <TabsTrigger value="tags" className="gap-2">
              <Tag className="h-4 w-4" /> Tags
            </TabsTrigger>
            <TabsTrigger value="permissions" className="gap-2">
              <Shield className="h-4 w-4" /> Permissões
            </TabsTrigger>
          </TabsList>

          <TabsContent value="categories" className="space-y-6">
            <div className="flex gap-4 items-end bg-muted/30 p-4 rounded-lg">
              <div className="grid gap-2 flex-1">
                <Label>Nova Categoria</Label>
                <Input
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Nome da categoria"
                />
              </div>
              <div className="grid gap-2 w-1/3">
                <Label>Categoria Pai</Label>
                <Select
                  value={newCatParent || 'root'}
                  onValueChange={setNewCatParent}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Raiz" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="root">Raiz (Sem pai)</SelectItem>
                    {categories
                      .filter((c) => !c.parentId)
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddCategory}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((cat) => {
                    const parent = categories.find((p) => p.id === cat.parentId)
                    return (
                      <TableRow key={cat.id}>
                        <TableCell
                          className={cat.parentId ? 'pl-8' : 'font-medium'}
                        >
                          {cat.parentId && (
                            <span className="text-muted-foreground mr-2">
                              ↳
                            </span>
                          )}
                          {cat.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {cat.parentId
                            ? `Subcategoria de ${parent?.name}`
                            : 'Categoria Principal'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteCategory(cat.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="tags" className="space-y-6">
            <div className="flex gap-4 items-end bg-muted/30 p-4 rounded-lg">
              <div className="grid gap-2 flex-1">
                <Label>Nova Tag</Label>
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Ex: tutorial"
                />
              </div>
              <Button onClick={handleAddTag}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 p-4 border rounded-lg min-h-[100px]">
              {tags.map((tag) => (
                <div
                  key={tag}
                  className="flex items-center gap-1 bg-secondary px-3 py-1 rounded-full text-sm"
                >
                  {tag}
                  <button
                    onClick={() => deleteTag(tag)}
                    className="ml-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="permissions" className="space-y-6">
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Papel</TableHead>
                    <TableHead className="text-center">Visualizar</TableHead>
                    <TableHead className="text-center">Editar</TableHead>
                    <TableHead className="text-center">Excluir</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permissions.map((perm) => (
                    <TableRow key={perm.role}>
                      <TableCell className="font-medium">
                        {translateRole(perm.role)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center">
                          <Switch
                            checked={perm.canView}
                            onCheckedChange={(c) =>
                              updatePermission(perm.role, { canView: c })
                            }
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center">
                          <Switch
                            checked={perm.canEdit}
                            onCheckedChange={(c) =>
                              updatePermission(perm.role, { canEdit: c })
                            }
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center">
                          <Switch
                            checked={perm.canDelete}
                            onCheckedChange={(c) =>
                              updatePermission(perm.role, { canDelete: c })
                            }
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
