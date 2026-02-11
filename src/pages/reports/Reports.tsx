import { useEffect, useState } from 'react'
import { useReportStore } from '@/stores/useReportStore'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ReportForm } from '@/components/reports/ReportForm'
import { ReportTemplate } from '@/types'
import useAuthStore from '@/stores/useAuthStore'
import {
  Plus,
  Play,
  Edit,
  Trash2,
  FileText,
  Loader2,
  ArrowLeft,
} from 'lucide-react'
import { format } from 'date-fns'
import { useNavigate } from 'react-router-dom'

export default function Reports() {
  const { user } = useAuthStore()
  const { templates, fetchTemplates, removeTemplate, triggerReport, loading } =
    useReportStore()
  const [isOpen, setIsOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<
    ReportTemplate | undefined
  >(undefined)
  const navigate = useNavigate()

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const handleEdit = (template: ReportTemplate) => {
    setEditingTemplate(template)
    setIsOpen(true)
  }

  const handleCreate = () => {
    setEditingTemplate(undefined)
    setIsOpen(true)
  }

  if (!user) return null

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Relatórios Automatizados
            </h1>
            <p className="text-muted-foreground">
              Gerencie templates de relatórios e envios recorrentes.
            </p>
          </div>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleCreate} className="gap-2">
              <Plus className="h-4 w-4" /> Novo Template
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? 'Editar Template' : 'Novo Template'}
              </DialogTitle>
            </DialogHeader>
            <ReportForm
              initialData={editingTemplate}
              organizationId={user.companyId}
              onSuccess={() => setIsOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Meus Templates</CardTitle>
          <CardDescription>Lista de relatórios configurados.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Frequência</TableHead>
                  <TableHead>Canais</TableHead>
                  <TableHead>Último Envio</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-500" />
                      {t.name}
                    </TableCell>
                    <TableCell>A cada {t.frequencyDays} dias</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {t.channels.map((c) => (
                          <Badge
                            key={c}
                            variant="outline"
                            className="text-[10px]"
                          >
                            {c === 'WHATSAPP_CLOUD' ? 'WA' : c}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {t.lastSentAt
                        ? format(new Date(t.lastSentAt), 'dd/MM/yyyy HH:mm')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.isActive ? 'success' : 'secondary'}>
                        {t.isActive ? 'Ativo' : 'Pausado'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => triggerReport(t.id)}
                          title="Gerar Agora"
                        >
                          <Play className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(t)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => removeTemplate(t.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {templates.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-muted-foreground"
                    >
                      Nenhum template encontrado. Crie um para começar.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
