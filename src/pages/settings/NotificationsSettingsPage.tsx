import { NotificationPreferences } from '@/components/settings/NotificationPreferences'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function NotificationsSettingsPage() {
  const navigate = useNavigate()

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/admin/settings')}
          className="rounded-full"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Preferências de Notificação
          </h1>
          <p className="text-muted-foreground">
            Gerencie como e quando você deseja ser alertado.
          </p>
        </div>
      </div>

      <NotificationPreferences />
    </div>
  )
}
