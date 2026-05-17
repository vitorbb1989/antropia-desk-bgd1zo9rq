import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

// Eager: parte do first paint / shell sempre presente.
import Login from '@/pages/auth/Login'
import Index from '@/pages/Index'
import NotFound from '@/pages/NotFound'
import Layout from '@/components/Layout'
import RoleGuard from '@/components/RoleGuard'
import { ThemeManager } from '@/components/ThemeManager'
import { LoadingScreen } from '@/components/LoadingScreen'

// Lazy: cada rota vira um chunk separado. Reduz o bundle inicial em ~60-70%.
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'))
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword'))
const TicketList = lazy(() => import('@/pages/tickets/TicketList'))
const NewTicket = lazy(() => import('@/pages/tickets/NewTicket'))
const TicketDetail = lazy(() => import('@/pages/tickets/TicketDetail'))
const Users = lazy(() => import('@/pages/admin/Users'))
const Settings = lazy(() => import('@/pages/admin/Settings'))
const Integrations = lazy(() => import('@/pages/admin/Integrations'))
const Workflows = lazy(() => import('@/pages/admin/Workflows'))
const WorkflowEditor = lazy(() => import('@/pages/admin/WorkflowEditor'))
const StatusPage = lazy(() => import('@/pages/admin/StatusPage'))
const NotificationsSettingsPage = lazy(() => import('@/pages/settings/NotificationsSettingsPage'))
const ProfileSettingsPage = lazy(() => import('@/pages/settings/ProfileSettingsPage'))
const Reports = lazy(() => import('@/pages/reports/Reports'))
const KnowledgeBase = lazy(() => import('@/pages/knowledge/KnowledgeBase'))
const ArticleDetail = lazy(() => import('@/pages/knowledge/ArticleDetail'))
const ArticleEditor = lazy(() => import('@/pages/knowledge/ArticleEditor'))
const NotificationsDocs = lazy(() => import('@/pages/docs/NotificationsDocs'))
const DeploymentDocs = lazy(() => import('@/pages/docs/DeploymentDocs'))
const MonitoringDocs = lazy(() => import('@/pages/docs/MonitoringDocs'))

import { AuthProvider } from '@/stores/useAuthStore'
import { TicketProvider } from '@/stores/useTicketStore'
import { KnowledgeProvider } from '@/stores/useKnowledgeStore'
import { SettingsProvider } from '@/stores/useSettingsStore'
import { NotificationProvider } from '@/stores/useNotificationStore'
import { UserPreferencesProvider } from '@/stores/useUserPreferencesStore'
import { CategoryProvider } from '@/stores/useCategoryStore'
import { AttachmentProvider } from '@/stores/useAttachmentStore'
import { DashboardProvider } from '@/stores/useDashboardStore'
import { ReportProvider } from '@/stores/useReportStore'
import { WorkflowProvider } from '@/stores/useWorkflowStore'
import { IntegrationProvider } from '@/stores/useIntegrationStore'
import { ServicePlanProvider } from '@/stores/useServicePlanStore'

const App = () => (
  <BrowserRouter
    future={{ v7_startTransition: false, v7_relativeSplatPath: false }}
  >
    <AuthProvider>
      <SettingsProvider>
        <ThemeManager />
        <CategoryProvider>
          <ServicePlanProvider>
          <NotificationProvider>
            <UserPreferencesProvider>
              <AttachmentProvider>
                <DashboardProvider>
                  <ReportProvider>
                    <WorkflowProvider>
                      <IntegrationProvider>
                        <TicketProvider>
                          <KnowledgeProvider>
                            <TooltipProvider>
                              <Toaster />
                              <Sonner />
                              <Suspense fallback={<LoadingScreen />}>
                                <Routes>
                                <Route path="/login" element={<Login />} />
                                <Route path="/forgot-password" element={<ForgotPassword />} />
                                <Route path="/reset-password" element={<ResetPassword />} />

                                <Route element={<Layout />}>
                                  <Route path="/" element={<Index />} />
                                  <Route
                                    path="/tickets"
                                    element={<TicketList />}
                                  />
                                  <Route
                                    path="/tickets/new"
                                    element={<NewTicket />}
                                  />
                                  <Route
                                    path="/tickets/:ticketId"
                                    element={<TicketDetail />}
                                  />

                                  <Route
                                    path="/admin/users"
                                    element={<RoleGuard allowedRoles={['ADMIN']}><Users /></RoleGuard>}
                                  />
                                  <Route
                                    path="/admin/settings"
                                    element={<RoleGuard allowedRoles={['ADMIN']}><Settings /></RoleGuard>}
                                  />
                                  <Route
                                    path="/admin/integrations"
                                    element={<RoleGuard allowedRoles={['ADMIN']}><Integrations /></RoleGuard>}
                                  />
                                  <Route
                                    path="/admin/workflows"
                                    element={<RoleGuard allowedRoles={['ADMIN', 'AGENT']}><Workflows /></RoleGuard>}
                                  />
                                  <Route
                                    path="/admin/workflows/new"
                                    element={<RoleGuard allowedRoles={['ADMIN', 'AGENT']}><WorkflowEditor /></RoleGuard>}
                                  />
                                  <Route
                                    path="/admin/workflows/:id"
                                    element={<RoleGuard allowedRoles={['ADMIN', 'AGENT']}><WorkflowEditor /></RoleGuard>}
                                  />
                                  <Route
                                    path="/admin/status"
                                    element={<RoleGuard allowedRoles={['ADMIN', 'AGENT']}><StatusPage /></RoleGuard>}
                                  />

                                  <Route
                                    path="/reports"
                                    element={<RoleGuard allowedRoles={['ADMIN', 'AGENT']}><Reports /></RoleGuard>}
                                  />

                                  {/* Notification Settings Route */}
                                  <Route
                                    path="/settings/notifications"
                                    element={<NotificationsSettingsPage />}
                                  />

                                  {/* Profile Settings Route */}
                                  <Route
                                    path="/settings/profile"
                                    element={<ProfileSettingsPage />}
                                  />

                                  {/* Docs Route */}
                                  <Route
                                    path="/docs/notifications"
                                    element={<NotificationsDocs />}
                                  />
                                  <Route
                                    path="/docs/deployment"
                                    element={<DeploymentDocs />}
                                  />
                                  <Route
                                    path="/docs/monitoring"
                                    element={<MonitoringDocs />}
                                  />

                                  {/* Knowledge Base Routes */}
                                  <Route
                                    path="/knowledge-base"
                                    element={<RoleGuard allowedRoles={['ADMIN', 'AGENT']}><KnowledgeBase /></RoleGuard>}
                                  />
                                  <Route
                                    path="/knowledge-base/new"
                                    element={<RoleGuard allowedRoles={['ADMIN', 'AGENT']}><ArticleEditor /></RoleGuard>}
                                  />
                                  <Route
                                    path="/knowledge-base/:articleId"
                                    element={<RoleGuard allowedRoles={['ADMIN', 'AGENT']}><ArticleDetail /></RoleGuard>}
                                  />
                                  <Route
                                    path="/knowledge-base/:articleId/edit"
                                    element={<RoleGuard allowedRoles={['ADMIN', 'AGENT']}><ArticleEditor /></RoleGuard>}
                                  />
                                </Route>

                                <Route path="*" element={<NotFound />} />
                                </Routes>
                              </Suspense>
                            </TooltipProvider>
                          </KnowledgeProvider>
                        </TicketProvider>
                      </IntegrationProvider>
                    </WorkflowProvider>
                  </ReportProvider>
                </DashboardProvider>
              </AttachmentProvider>
            </UserPreferencesProvider>
          </NotificationProvider>
        </ServicePlanProvider>
        </CategoryProvider>
      </SettingsProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
