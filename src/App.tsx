import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

import Login from '@/pages/auth/Login'
import ForgotPassword from '@/pages/auth/ForgotPassword'
import ResetPassword from '@/pages/auth/ResetPassword'
import Index from '@/pages/Index'
import TicketList from '@/pages/tickets/TicketList'
import NewTicket from '@/pages/tickets/NewTicket'
import TicketDetail from '@/pages/tickets/TicketDetail'
import Users from '@/pages/admin/Users'
import Settings from '@/pages/admin/Settings'
import Integrations from '@/pages/admin/Integrations'
import Workflows from '@/pages/admin/Workflows'
import WorkflowEditor from '@/pages/admin/WorkflowEditor'
import StatusPage from '@/pages/admin/StatusPage'
import NotificationsSettingsPage from '@/pages/settings/NotificationsSettingsPage'
import ProfileSettingsPage from '@/pages/settings/ProfileSettingsPage'
import Reports from '@/pages/reports/Reports'
import NotFound from '@/pages/NotFound'
import KnowledgeBase from '@/pages/knowledge/KnowledgeBase'
import ArticleDetail from '@/pages/knowledge/ArticleDetail'
import ArticleEditor from '@/pages/knowledge/ArticleEditor'
import NotificationsDocs from '@/pages/docs/NotificationsDocs'
import DeploymentDocs from '@/pages/docs/DeploymentDocs'
import MonitoringDocs from '@/pages/docs/MonitoringDocs'
import Layout from '@/components/Layout'
import RoleGuard from '@/components/RoleGuard'
import { ThemeManager } from '@/components/ThemeManager'

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
