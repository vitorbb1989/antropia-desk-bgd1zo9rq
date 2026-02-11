import { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { useWorkflowStore } from '@/stores/useWorkflowStore'
import { Plus, Workflow as WorkflowIcon, Trash2, Edit } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useNavigate } from 'react-router-dom'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default function Workflows() {
  const { workflows, fetchWorkflows, loading, deleteWorkflow, toggleWorkflow } =
    useWorkflowStore()
  const navigate = useNavigate()

  useEffect(() => {
    fetchWorkflows()
  }, [fetchWorkflows])

  return (
    <div className="max-w-6xl mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Automações & Workflows
          </h1>
          <p className="text-muted-foreground">
            Crie regras para automatizar tarefas repetitivas.
          </p>
        </div>
        <Button
          onClick={() => navigate('/admin/workflows/new')}
          className="gap-2"
        >
          <Plus className="h-4 w-4" /> Novo Workflow
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Meus Workflows</CardTitle>
          <CardDescription>Lista de automações configuradas.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && workflows.length === 0 ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Gatilho</TableHead>
                  <TableHead>Ações</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workflows.map((workflow) => (
                  <TableRow key={workflow.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      <WorkflowIcon className="h-4 w-4 text-primary" />
                      {workflow.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{workflow.triggerType}</Badge>
                    </TableCell>
                    <TableCell>{workflow.actions.length} ação(ões)</TableCell>
                    <TableCell>
                      <Switch
                        checked={workflow.isActive}
                        onCheckedChange={(c) => toggleWorkflow(workflow.id, c)}
                      />
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          navigate(`/admin/workflows/${workflow.id}`)
                        }
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => deleteWorkflow(workflow.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {workflows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-8 text-muted-foreground"
                    >
                      Nenhuma automação encontrada.
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
