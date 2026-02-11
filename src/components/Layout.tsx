import { Outlet, Navigate } from 'react-router-dom'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppHeader } from '@/components/layout/AppHeader'
import useAuthStore from '@/stores/useAuthStore'
import { Loader2 } from 'lucide-react'

export default function Layout() {
  const { isAuthenticated, loading } = useAuthStore()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6 bg-secondary/20">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
