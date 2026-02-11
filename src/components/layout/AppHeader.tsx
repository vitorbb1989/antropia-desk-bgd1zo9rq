import { SidebarTrigger } from '@/components/ui/sidebar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { useLocation } from 'react-router-dom'
import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import useAuthStore from '@/stores/useAuthStore'
import useTicketStore from '@/stores/useTicketStore'
import { NotificationCenter } from '@/components/notifications/NotificationCenter'

const PATH_MAP: Record<string, string> = {
  tickets: 'Chamados',
  new: 'Novo',
  admin: 'Admin',
  users: 'Usuários',
  settings: 'Configurações',
  knowledge: 'Base de Conhecimento',
  'knowledge-base': 'Base de Conhecimento',
  edit: 'Editar',
  docs: 'Documentação',
  notifications: 'Notificações',
}

export function AppHeader() {
  const location = useLocation()
  const { user } = useAuthStore()
  const { tickets } = useTicketStore() // To get ticket readableId if available

  const pathSegments = location.pathname.split('/').filter(Boolean)

  const breadcrumbs = pathSegments.map((segment, index) => {
    const path = `/${pathSegments.slice(0, index + 1).join('/')}`
    const isLast = index === pathSegments.length - 1

    let label = PATH_MAP[segment.toLowerCase()] || segment

    // Check if segment is a UUID (Ticket ID)
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        segment,
      )
    ) {
      const ticket = tickets.find((t) => t.id === segment)
      if (ticket) {
        label = `Chamado #${ticket.readableId}`
      } else {
        label = 'Detalhes'
      }
    } else {
      label = label.charAt(0).toUpperCase() + label.slice(1).replace(/-/g, ' ')
    }

    return { label, path, isLast }
  })

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-2 px-6 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="-ml-1 h-9 w-9 text-muted-foreground hover:text-foreground rounded-md" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <Link
                to="/"
                className="hidden md:block text-muted-foreground hover:text-primary transition-colors font-medium text-sm"
              >
                Início
              </Link>
            </BreadcrumbItem>
            {breadcrumbs.length > 0 && (
              <BreadcrumbSeparator className="hidden md:block opacity-40" />
            )}
            {breadcrumbs.map((crumb, i) => (
              <Fragment key={crumb.path}>
                <BreadcrumbItem>
                  {crumb.isLast ? (
                    <BreadcrumbPage className="font-semibold text-foreground max-w-[200px] truncate text-sm">
                      {crumb.label}
                    </BreadcrumbPage>
                  ) : (
                    <Link
                      to={crumb.path}
                      className="text-muted-foreground hover:text-primary transition-colors font-medium text-sm"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </BreadcrumbItem>
                {!crumb.isLast && (
                  <BreadcrumbSeparator className="opacity-40" />
                )}
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="flex items-center gap-2">
        <NotificationCenter />

        {user?.role === 'USER' && (
          <Button
            size="sm"
            asChild
            className="hidden md:flex shadow-sm rounded-full h-8 px-4"
          >
            <Link to="/tickets/new">
              <Plus className="mr-2 h-3.5 w-3.5" />
              Novo Chamado
            </Link>
          </Button>
        )}
      </div>
    </header>
  )
}
