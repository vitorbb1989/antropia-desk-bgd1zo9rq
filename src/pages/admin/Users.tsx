import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import useAuthStore from '@/stores/useAuthStore'
import useServicePlanStore from '@/stores/useServicePlanStore'
import { supabase } from '@/lib/supabase/client'
import { translateRole } from '@/utils/translations'
import { MoreHorizontal, Plus, Shield, ShieldAlert, User, Loader2, Briefcase } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

export default function Users() {
  const { user, users, updateUserStatus, fetchOrgUsers } = useAuthStore()
  const { servicePlans, assignServicePlans, getUserServicePlanIds } = useServicePlanStore()
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<string>('USER')
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([])
  const [inviting, setInviting] = useState(false)

  // Service plan management dialog
  const [planDialogOpen, setPlanDialogOpen] = useState(false)
  const [planDialogUser, setPlanDialogUser] = useState<{ id: string; name: string } | null>(null)
  const [editPlanIds, setEditPlanIds] = useState<string[]>([])
  const [savingPlans, setSavingPlans] = useState(false)

  const handleRemoveUser = async (userId: string, email: string) => {
    if (!confirm(`Remover ${email || 'este usuário'} da organização?`)) return
    setLoading(true)
    try {
      const { error } = await supabase
        .from('memberships')
        .delete()
        .eq('user_id', userId)
      if (error) throw error
      toast.success('Usuário removido da organização.')
      fetchOrgUsers()
    } catch {
      toast.error('Erro ao remover usuário.')
    } finally {
      setLoading(false)
    }
  }

  const handleInviteUser = async () => {
    if (!inviteEmail) {
      toast.error('Informe o e-mail do usuário.')
      return
    }

    if (inviteRole === 'USER' && selectedPlanIds.length === 0) {
      toast.error('Selecione pelo menos um serviço contratado para o cliente.')
      return
    }

    setInviting(true)
    try {
      const { data, error } = await supabase.rpc('invite_user', {
        p_email: inviteEmail.trim().toLowerCase(),
        p_full_name: inviteName.trim(),
        p_role: inviteRole,
        p_organization_id: user?.companyId,
      })

      if (error) throw error

      const result = data as { success: boolean; action: string; user_id: string; note?: string }

      // Assign service plans if USER role
      if (inviteRole === 'USER' && selectedPlanIds.length > 0 && result.user_id) {
        await assignServicePlans(result.user_id, selectedPlanIds)
      }

      if (result.action === 'user_created') {
        toast.success(`Usuário ${inviteEmail} criado. Peça para usar "Esqueceu a senha" no login para definir a senha.`)
      } else {
        toast.success(`Usuário ${inviteEmail} adicionado à organização.`)
      }

      setDialogOpen(false)
      setInviteEmail('')
      setInviteName('')
      setInviteRole('USER')
      setSelectedPlanIds([])
      fetchOrgUsers()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao convidar usuário.'
      toast.error(msg)
    } finally {
      setInviting(false)
    }
  }

  const togglePlanId = (planId: string, list: string[], setter: (v: string[]) => void) => {
    setter(
      list.includes(planId)
        ? list.filter((id) => id !== planId)
        : [...list, planId]
    )
  }

  const handleOpenPlanDialog = async (userId: string, userName: string) => {
    setPlanDialogUser({ id: userId, name: userName })
    setPlanDialogOpen(true)
    try {
      const ids = await getUserServicePlanIds(userId)
      setEditPlanIds(ids)
    } catch {
      setEditPlanIds([])
    }
  }

  const handleSavePlans = async () => {
    if (!planDialogUser) return
    setSavingPlans(true)
    try {
      await assignServicePlans(planDialogUser.id, editPlanIds)
      toast.success(`Serviços de ${planDialogUser.name} atualizados.`)
      setPlanDialogOpen(false)
    } catch {
      toast.error('Erro ao atualizar serviços.')
    } finally {
      setSavingPlans(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Usuários & Acesso
          </h1>
          <p className="text-muted-foreground">
            Gerencie membros da equipe e clientes.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Convidar Usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Convidar Usuário</DialogTitle>
              <DialogDescription>
                O usuário receberá acesso à plataforma. Se for um novo usuário, ele deverá usar "Esqueceu a senha" para definir sua senha.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">E-mail</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="usuario@empresa.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-name">Nome completo</Label>
                <Input
                  id="invite-name"
                  placeholder="Nome do usuário"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role">Função</Label>
                <Select value={inviteRole} onValueChange={(v) => { setInviteRole(v); if (v !== 'USER') setSelectedPlanIds([]) }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Administrador</SelectItem>
                    <SelectItem value="AGENT">Agente</SelectItem>
                    <SelectItem value="USER">Usuário (Cliente)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {inviteRole === 'USER' && servicePlans.length > 0 && (
                <div className="space-y-3">
                  <Label>Serviços Contratados</Label>
                  <p className="text-xs text-muted-foreground">
                    Selecione os serviços que este cliente contratou. Isso define quais tipos de chamados ele poderá abrir.
                  </p>
                  <div className="space-y-2 rounded-lg border p-3">
                    {servicePlans.map((plan) => (
                      <label
                        key={plan.id}
                        className="flex items-center gap-3 cursor-pointer rounded-md p-2 hover:bg-muted/50 transition-colors"
                      >
                        <Checkbox
                          checked={selectedPlanIds.includes(plan.id)}
                          onCheckedChange={() => togglePlanId(plan.id, selectedPlanIds, setSelectedPlanIds)}
                        />
                        <div
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: plan.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{plan.name}</div>
                          {plan.description && (
                            <div className="text-xs text-muted-foreground truncate">
                              {plan.description}
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleInviteUser} disabled={inviting}>
                {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Convidar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-0 shadow-subtle">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Usuário</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead className="text-right pr-6">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="pl-6">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={u.avatar} />
                        <AvatarFallback>{u.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{u.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {u.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {u.role === 'ADMIN' && (
                        <ShieldAlert className="h-4 w-4 text-red-500" />
                      )}
                      {u.role === 'AGENT' && (
                        <Shield className="h-4 w-4 text-blue-500" />
                      )}
                      {u.role === 'USER' && (
                        <User className="h-4 w-4 text-slate-500" />
                      )}
                      <span>{translateRole(u.role)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {u.email || '—'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {u.role === 'USER' && (
                          <DropdownMenuItem
                            onClick={() => handleOpenPlanDialog(u.id, u.name)}
                          >
                            <Briefcase className="mr-2 h-4 w-4" />
                            Gerenciar Serviços
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleRemoveUser(u.id, u.email)}
                        >
                          Remover da organização
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog for managing service plans of existing users */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Serviços Contratados</DialogTitle>
            <DialogDescription>
              {planDialogUser?.name ? `Gerenciar serviços de ${planDialogUser.name}` : 'Gerenciar serviços'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {servicePlans.map((plan) => (
              <label
                key={plan.id}
                className="flex items-center gap-3 cursor-pointer rounded-md p-3 hover:bg-muted/50 transition-colors border"
              >
                <Checkbox
                  checked={editPlanIds.includes(plan.id)}
                  onCheckedChange={() => togglePlanId(plan.id, editPlanIds, setEditPlanIds)}
                />
                <div
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: plan.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{plan.name}</div>
                  {plan.description && (
                    <div className="text-xs text-muted-foreground line-clamp-2">
                      {plan.description}
                    </div>
                  )}
                </div>
              </label>
            ))}
            {servicePlans.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum serviço cadastrado.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSavePlans} disabled={savingPlans}>
              {savingPlans && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
