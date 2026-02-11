import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Ticket,
  PlusCircle,
  Settings,
  Users,
  LogOut,
  LifeBuoy,
  BookOpen,
  Bell,
  User as UserIcon,
  HelpCircle,
  Workflow,
  LayoutGrid,
  Monitor,
} from 'lucide-react'
import useAuthStore from '@/stores/useAuthStore'
import useSettingsStore from '@/stores/useSettingsStore'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

export function AppSidebar() {
  const { user, logout } = useAuthStore()
  const { settings } = useSettingsStore()
  const location = useLocation()
  const { open } = useSidebar()

  if (!user) return null

  const isActive = (path: string) =>
    location.pathname === path ||
    (path !== '/' && location.pathname.startsWith(path))

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-border/40 bg-secondary/10"
    >
      <SidebarHeader className="h-16 flex items-center justify-center pt-4 pb-2">
        <div className="flex items-center gap-3 w-full px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm overflow-hidden shrink-0">
            {settings.branding.iconUrl ? (
              <img
                src={settings.branding.iconUrl}
                alt="Icon"
                className="h-5 w-5 object-contain"
              />
            ) : (
              <LifeBuoy className="h-5 w-5" />
            )}
          </div>
          {open && (
            <div className="flex flex-col gap-0.5 overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-left-2">
              <span className="font-semibold text-sm truncate leading-none">
                Antropia Desk
              </span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                {user.role === 'ADMIN'
                  ? 'Admin Workspace'
                  : 'Portal do Cliente'}
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground/70 px-2 py-2">
            Navegação
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === '/'}
                  tooltip="Dashboard"
                  className="rounded-lg h-10 px-3"
                >
                  <Link to="/">
                    <LayoutDashboard className="h-4 w-4" />
                    <span className="font-medium">Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive('/tickets')}
                  tooltip="Chamados"
                  className="rounded-lg h-10 px-3"
                >
                  <Link to="/tickets">
                    <Ticket className="h-4 w-4" />
                    <span className="font-medium">
                      {user.role === 'USER' ? 'Meus Chamados' : 'Chamados'}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {user.role === 'USER' && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/tickets/new')}
                    tooltip="Novo Chamado"
                    className="rounded-lg h-10 px-3"
                  >
                    <Link to="/tickets/new">
                      <PlusCircle className="h-4 w-4" />
                      <span className="font-medium">Abrir Chamado</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {/* Status Page - Admin Only */}
              {user.role === 'ADMIN' && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/admin/status')}
                    tooltip="Status Page"
                    className="rounded-lg h-10 px-3"
                  >
                    <Link to="/admin/status">
                      <Monitor className="h-4 w-4" />
                      <span className="font-medium">Status Page</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {(user.role === 'ADMIN' || user.role === 'AGENT') && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/knowledge-base')}
                    tooltip="Base de Conhecimento"
                    className="rounded-lg h-10 px-3"
                  >
                    <Link to="/knowledge-base">
                      <BookOpen className="h-4 w-4" />
                      <span className="font-medium">Base de Conhecimento</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground/70 px-2 py-2 mt-4">
            Preferências
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive('/settings/notifications')}
                  tooltip="Notificações"
                  className="rounded-lg h-10 px-3"
                >
                  <Link to="/settings/notifications">
                    <Bell className="h-4 w-4" />
                    <span className="font-medium">Notificações</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {user.role === 'ADMIN' && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive('/admin/users')}
                      tooltip="Usuários"
                      className="rounded-lg h-10 px-3"
                    >
                      <Link to="/admin/users">
                        <Users className="h-4 w-4" />
                        <span className="font-medium">Usuários</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive('/admin/workflows')}
                      tooltip="Automações"
                      className="rounded-lg h-10 px-3"
                    >
                      <Link to="/admin/workflows">
                        <Workflow className="h-4 w-4" />
                        <span className="font-medium">Automações</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive('/admin/integrations')}
                      tooltip="Integrações"
                      className="rounded-lg h-10 px-3"
                    >
                      <Link to="/admin/integrations">
                        <LayoutGrid className="h-4 w-4" />
                        <span className="font-medium">Integrações</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive('/admin/settings')}
                      tooltip="Configurações"
                      className="rounded-lg h-10 px-3"
                    >
                      <Link to="/admin/settings">
                        <Settings className="h-4 w-4" />
                        <span className="font-medium">Configurações</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border/40">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="rounded-xl transition-all hover:bg-white hover:shadow-sm data-[state=open]:bg-white data-[state=open]:shadow-sm"
                >
                  <Avatar className="h-8 w-8 rounded-lg border">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="rounded-lg">CN</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold text-xs">
                      {user.name}
                    </span>
                    <span className="truncate text-[10px] text-muted-foreground">
                      {user.email}
                    </span>
                  </div>
                  <Settings className="ml-auto size-4 opacity-50" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-xl p-2"
                side="bottom"
                align="end"
                sideOffset={8}
              >
                <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                  <Link to="/settings/profile">
                    <UserIcon className="mr-2 h-4 w-4" />
                    Meu Perfil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem className="rounded-lg cursor-pointer">
                  <HelpCircle className="mr-2 h-4 w-4" />
                  Ajuda
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1" />
                <DropdownMenuItem
                  onClick={logout}
                  className="rounded-lg cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
