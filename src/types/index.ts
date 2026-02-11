export type UserRole = 'ADMIN' | 'AGENT' | 'USER'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  avatar?: string
  companyId: string
  active: boolean
  phone?: string
}

export interface ServicePlan {
  id: string
  organizationId: string
  name: string
  description: string
  color: string
  icon: string
  isActive: boolean
  displayOrder: number
  createdAt: string
  updatedAt: string
}

export interface UserServiceCategory {
  categoryId: string
  categoryName: string
  categoryDescription: string
  categorySlaHours: number
  categoryColor: string
  categorySlug: string
  servicePlanId: string
  servicePlanName: string
  servicePlanColor: string
  servicePlanIcon: string
}

export type TicketType = 'BUG' | 'REQUEST' | 'FINANCE' | 'OTHER'

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export type TicketStatus =
  | 'RECEIVED'
  | 'IN_PROGRESS'
  | 'WAITING_CUSTOMER'
  | 'WAITING_APPROVAL'
  | 'APPROVED'
  | 'CLOSED'

export interface TicketCategory {
  id: string
  organizationId: string
  name: string
  description: string
  slaHours: number
  color: string
  slug: string
  createdAt: string
  updatedAt: string
}

export interface Attachment {
  id: string
  organizationId: string
  ticketId: string
  name: string
  type: string
  size: number
  storagePath: string
  storageBucket: string
  extension: string
  uploadedBy: string
  createdAt: string
  deletedAt?: string | null
  deletedBy?: string | null
  url?: string
}

export interface Message {
  id: string
  ticketId: string
  senderId: string
  content: string
  isInternal: boolean
  createdAt: string
  attachments?: Attachment[]
  type: 'MESSAGE' | 'EVENT' | 'NOTIFICATION'
  metadata?: Record<string, any>
}

export interface Ticket {
  id: string
  readableId: string
  title: string
  description: string
  type: TicketType
  status: TicketStatus
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  requesterId: string
  assigneeId?: string
  companyId: string
  createdAt: string
  updatedAt: string
  dueDate?: string
  categoryId?: string
  tags: string[]
  slaWarningSentAt?: string
  slaBreachSentAt?: string
  estimatedCost?: number
  satisfactionScore?: number
  satisfactionComment?: string
}

export interface Company {
  id: string
  name: string
  logo: string
}

export interface Category {
  id: string
  name: string
  parentId: string | null
}

export interface ArticleVersion {
  id: string
  articleId: string
  content: string
  title: string
  categoryId: string
  tags: string[]
  updatedAt: string
  editorId: string
}

export interface KBPermission {
  role: UserRole
  canView: boolean
  canEdit: boolean
  canDelete: boolean
}

export interface Article {
  id: string
  title: string
  content: string
  categoryId: string
  authorId: string
  createdAt: string
  updatedAt: string
  tags: string[]
}

// Notification System Types

export type NotificationChannelType =
  | 'WHATSAPP_CLOUD'
  | 'EVOLUTION'
  | 'EMAIL'
  | 'SMS'

export type NotificationEventType =
  | 'TICKET_CREATED'
  | 'TICKET_UPDATED'
  | 'TICKET_ASSIGNED'
  | 'TICKET_COMMENT'
  | 'WAITING_APPROVAL'
  | 'APPROVAL_REMINDER_24H'
  | 'TICKET_CLOSED'
  | 'SOLUTION_SENT'
  | 'SLA_WARNING'
  | 'SLA_BREACH'
  | 'MENTION'
  | 'TICKET_CUSTOMER_REPLY'
  | 'REPORT'
  | 'STATUS_CHANGED'
  | 'PRIORITY_UPDATED'

export interface NotificationChannelConfig {
  type: NotificationChannelType
  enabled: boolean
  config: {
    apiKey?: string
    phoneNumberId?: string
    wabaId?: string
    instanceName?: string
    serverUrl?: string
    smtpHost?: string
    smtpPort?: string
    smtpUser?: string
    senderEmail?: string
  }
}

// New DB Based Template Structure
export interface NotificationTemplate {
  id: string
  organizationId: string
  name: string
  eventType: NotificationEventType
  channel: NotificationChannelType | 'DEFAULT'
  subjectTemplate?: string
  bodyTemplate: string
  header?: string
  footer?: string
  createdAt?: string
  updatedAt?: string
  enabled: boolean
}

export interface BrandingSettings {
  logoUrl: string
  iconUrl: string
  faviconUrl: string
  primaryColor: string
}

export interface NotificationPayload {
  event_version: string
  event_type: NotificationEventType
  company: { id: string; name: string }
  ticket: {
    id: string
    public_id: string
    title: string
    type: string
    priority: string
    status: string
    created_at: string
    updated_at: string
    portal_url: string
  }
  actors: {
    requester: { name: string; email: string; phone?: string }
    assigned_agent?: { name: string; email: string }
  }
  update: {
    kind: string
    summary: string
  }
  approval: { deadline_at: string | null }
}

export interface NotificationOutbox {
  id: string
  companyId: string
  ticketId: string
  eventType: NotificationEventType
  payloadJson: string
  scheduledAt: string
  status: 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'CANCELLED'
  attempts: number
  lastError?: string
  createdAt: string
  updatedAt: string
}

export interface NotificationDelivery {
  id: string
  outboxId: string
  channel: NotificationChannelType
  recipient: string
  providerMessageId?: string
  status: 'PENDING' | 'SENT' | 'FAILED' | 'RETRYING'
  attempts: number
  lastError?: string
  createdAt: string
  sentAt?: string
  body?: string
  subject?: string
}

export interface SystemSettings {
  maxFileSize: number
  allowedFileTypes: string[]
  notificationChannels: NotificationChannelConfig[]
  notificationTemplates: NotificationTemplate[]
  branding: BrandingSettings
}

export type NotificationFrequency = 'IMMEDIATE' | 'HOURLY' | 'DAILY'

export interface UserPreference {
  userId: string
  channels: {
    email: boolean
    whatsapp: boolean
    sms: boolean
  }
  contactInfo: {
    email?: string
    phoneNumber?: string
  }
  events: {
    ticketCreated: boolean
    ticketAssigned: boolean
    newMessage: boolean
    ticketClosed: boolean
    mention: boolean
    newAttachment: boolean
    statusUpdated: boolean
  }
  quietHours: {
    enabled: boolean
    start: string
    end: string
  }
  summaryMode: NotificationFrequency
}

export interface AnalyticsStats {
  totalOpen: number
  byStatus: Record<string, number>
  byPriority: Record<string, number>
  slaBreached: number
  agentPerformance?: {
    agentId: string
    agentName: string
    assigned: number
    closed: number
    avgResolutionTimeHours: number
  }[]
  trends?: {
    date: string
    created: number
    resolved: number
  }[]
  byCategory?: {
    categoryName: string
    count: number
  }[]
}

// New Types for Reports
export interface ReportTemplate {
  id: string
  organizationId: string
  name: string
  metrics: string[]
  channels: string[]
  recipientEmails: string[]
  recipientPhones: string[]
  frequencyDays: number
  lastSentAt?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface DashboardPreferences {
  userId: string
  visibleWidgets: string[]
  updatedAt: string
}

// Workflows & Integrations
export type WorkflowTriggerType =
  | 'TICKET_CREATED'
  | 'STATUS_CHANGED'
  | 'PRIORITY_UPDATED'
  | 'TICKET_CUSTOMER_REPLY'
export type WorkflowActionType =
  | 'SEND_NOTIFICATION'
  | 'UPDATE_TICKET'
  | 'TRIGGER_INTEGRATION'
  | 'ADD_TAG'
  | 'PLANKA_CREATE_SUBTASK'

export interface WorkflowCondition {
  field: string
  operator: 'EQUALS' | 'NOT_EQUALS'
  value: string
}

export interface WorkflowAction {
  type: WorkflowActionType
  config: Record<string, any> // e.g., { provider: 'PLANKA', tag: 'VIP' }
}

export interface Workflow {
  id: string
  organizationId: string
  name: string
  triggerType: WorkflowTriggerType
  conditions: WorkflowCondition[]
  actions: WorkflowAction[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type IntegrationProvider =
  | 'PLANKA'
  | 'BOOKSTACK'
  | 'KRAYIN'
  | 'CHATWOOT'
  | 'TYPEBOT'

export interface PlankaSettings {
  apiUrl: string
  apiToken: string
  projectId: string
  boardId: string
  listId: string
}

export interface IntegrationConfig {
  id: string
  organizationId: string
  provider: IntegrationProvider
  settings: Record<string, any>
  isEnabled: boolean
  updatedAt: string
}

export interface IntegrationLog {
  id: string
  organizationId: string
  integrationType: string
  status: 'PENDING' | 'SUCCESS' | 'FAILED'
  requestData: any
  responseData: any
  errorMessage: string
  durationMs: number | null
  createdAt: string
}
