import { isAllowedUrl } from './ssrf-guard.ts'

/** Redact potential secrets from error messages before logging/storing */
function sanitizeError(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9_\-\.]+/gi, 'Bearer [REDACTED]')
    .replace(/apikey[:\s]+[A-Za-z0-9_\-\.]+/gi, 'apikey: [REDACTED]')
    .replace(/sk_[a-z]+_[A-Za-z0-9]+/g, '[API_KEY_REDACTED]')
    .replace(/password['":\s]+[^\s,}"']+/gi, 'password: [REDACTED]')
}

export interface OrgNotificationSettings {
  smtp_enabled: boolean
  smtp_host: string | null
  smtp_port: number | null
  smtp_user: string | null
  smtp_password: string | null
  smtp_from_email: string | null
  smtp_from_name: string | null
  smtp_secure: boolean | null
  resend_enabled: boolean
  resend_api_key: string | null
  resend_from_email: string | null
  resend_from_name: string | null
  fallback_to_resend: boolean
  whatsapp_cloud_enabled: boolean
  whatsapp_cloud_access_token: string | null
  whatsapp_cloud_phone_number_id: string | null
  whatsapp_cloud_waba_id: string | null
  evolution_enabled: boolean
  evolution_api_url: string | null
  evolution_api_key: string | null
  evolution_instance_name: string | null
}

export interface SendResult {
  success: boolean
  externalId?: string
  error?: string
}

/**
 * Replaces {{path.to.key}} mustache-style variables in a template string.
 */
export function renderTemplate(template: string, data: any): string {
  if (!template) return ''
  return template.replace(/\{\{(.*?)\}\}/g, (_match, path) => {
    const keys = path.trim().split('.')
    let value = data
    for (const k of keys) {
      if (value === undefined || value === null) return _match
      value = value[k]
    }
    return value !== undefined && value !== null ? String(value) : _match
  })
}

/**
 * Resolves template content for a notification.
 * If template_data contains a template_id, loads the template from DB and renders it.
 */
export async function resolveTemplateContent(
  supabase: any,
  notification: any,
): Promise<{ subject: string; body: string }> {
  const templateData = notification.template_data
  if (!templateData?.template_id) {
    return { subject: notification.subject, body: notification.body }
  }

  const { data: template } = await supabase
    .from('notification_templates')
    .select('*')
    .eq('id', templateData.template_id)
    .eq('organization_id', notification.organization_id)
    .single()

  if (!template) {
    return { subject: notification.subject, body: notification.body }
  }

  const payload = templateData
  const body = [
    renderTemplate(template.header || '', payload),
    renderTemplate(template.body_template || '', payload),
    renderTemplate(template.footer || '', payload),
  ].filter(Boolean).join('\n\n')

  const subject = template.subject_template
    ? renderTemplate(template.subject_template, payload)
    : notification.subject

  return { subject, body }
}

// ─── Email Senders ───────────────────────────────────────────────

/**
 * Send email via Resend API (HTTP-based, no SMTP dependency).
 */
async function sendViaResend(
  settings: OrgNotificationSettings,
  to: string,
  subject: string,
  body: string,
): Promise<SendResult> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.resend_api_key}`,
    },
    body: JSON.stringify({
      from: settings.resend_from_name
        ? `${settings.resend_from_name} <${settings.resend_from_email}>`
        : settings.resend_from_email,
      to: [to],
      subject,
      html: body,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return { success: false, error: sanitizeError(`Resend API error ${res.status}: ${err}`) }
  }

  const data = await res.json()
  return { success: true, externalId: data.id }
}

/**
 * Send email via SMTP using Deno-compatible nodemailer.
 */
async function sendViaSMTP(
  settings: OrgNotificationSettings,
  to: string,
  subject: string,
  body: string,
): Promise<SendResult> {
  try {
    const nodemailer = await import('npm:nodemailer@6')
    const transporter = nodemailer.default.createTransport({
      host: settings.smtp_host,
      port: settings.smtp_port || 587,
      secure: settings.smtp_secure ?? false,
      auth: {
        user: settings.smtp_user,
        pass: settings.smtp_password,
      },
    })

    const info = await transporter.sendMail({
      from: settings.smtp_from_name
        ? `${settings.smtp_from_name} <${settings.smtp_from_email}>`
        : settings.smtp_from_email,
      to,
      subject,
      html: body,
    })

    return { success: true, externalId: info.messageId }
  } catch (err: any) {
    return { success: false, error: sanitizeError(`SMTP error: ${err.message}`) }
  }
}

/**
 * Send an email notification. Tries SMTP first, falls back to Resend if configured.
 */
export async function sendEmail(
  settings: OrgNotificationSettings,
  to: string,
  subject: string,
  body: string,
): Promise<SendResult> {
  if (!to) return { success: false, error: 'No recipient email' }

  // Try SMTP first
  if (settings.smtp_enabled && settings.smtp_host) {
    const result = await sendViaSMTP(settings, to, subject, body)
    if (result.success) return result

    // Fallback to Resend if configured
    if (settings.fallback_to_resend && settings.resend_enabled && settings.resend_api_key) {
      console.warn(`SMTP failed (${result.error}), falling back to Resend`)
      return sendViaResend(settings, to, subject, body)
    }
    return result
  }

  // Try Resend directly
  if (settings.resend_enabled && settings.resend_api_key) {
    return sendViaResend(settings, to, subject, body)
  }

  return { success: false, error: 'No email provider configured (SMTP or Resend)' }
}

// ─── WhatsApp Senders ────────────────────────────────────────────

/**
 * Send WhatsApp message via Meta Cloud API.
 */
export async function sendWhatsAppCloud(
  settings: OrgNotificationSettings,
  to: string,
  body: string,
): Promise<SendResult> {
  if (!to) return { success: false, error: 'No recipient phone' }
  if (!settings.whatsapp_cloud_phone_number_id || !settings.whatsapp_cloud_access_token) {
    return { success: false, error: 'WhatsApp Cloud not configured' }
  }

  const phoneNumberId = settings.whatsapp_cloud_phone_number_id
  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.whatsapp_cloud_access_token}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to.replace(/\D/g, ''),
      type: 'text',
      text: { body },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return { success: false, error: sanitizeError(`WhatsApp Cloud API error ${res.status}: ${err}`) }
  }

  const data = await res.json()
  const messageId = data.messages?.[0]?.id
  return { success: true, externalId: messageId }
}

/**
 * Send WhatsApp message via Evolution API.
 */
export async function sendEvolution(
  settings: OrgNotificationSettings,
  to: string,
  body: string,
): Promise<SendResult> {
  if (!to) return { success: false, error: 'No recipient phone' }
  if (!settings.evolution_api_url || !settings.evolution_api_key || !settings.evolution_instance_name) {
    return { success: false, error: 'Evolution API not configured' }
  }

  if (!isAllowedUrl(settings.evolution_api_url)) {
    return { success: false, error: 'Evolution API URL blocked: private/internal network' }
  }

  const baseUrl = settings.evolution_api_url.endsWith('/')
    ? settings.evolution_api_url.slice(0, -1)
    : settings.evolution_api_url
  const instanceName = settings.evolution_instance_name
  const url = `${baseUrl}/message/sendText/${instanceName}`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: settings.evolution_api_key,
    },
    body: JSON.stringify({
      number: to.replace(/\D/g, ''),
      text: body,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return { success: false, error: sanitizeError(`Evolution API error ${res.status}: ${err}`) }
  }

  const data = await res.json()
  return { success: true, externalId: data.key?.id || data.messageId }
}

// ─── Dispatcher ──────────────────────────────────────────────────

/**
 * Dispatch a notification to the appropriate provider based on channel and org settings.
 */
export async function dispatchNotification(
  settings: OrgNotificationSettings,
  channel: string,
  to: string,
  subject: string,
  body: string,
): Promise<SendResult> {
  switch (channel) {
    case 'EMAIL':
      return sendEmail(settings, to, subject, body)

    case 'WHATSAPP':
      // Prefer WhatsApp Cloud API, fallback to Evolution
      if (settings.whatsapp_cloud_enabled) {
        const result = await sendWhatsAppCloud(settings, to, body)
        if (result.success) return result

        // Fallback to Evolution if available
        if (settings.evolution_enabled) {
          console.warn(`WhatsApp Cloud failed (${result.error}), falling back to Evolution`)
          return sendEvolution(settings, to, body)
        }
        return result
      }
      if (settings.evolution_enabled) {
        return sendEvolution(settings, to, body)
      }
      return { success: false, error: 'No WhatsApp provider configured' }

    default:
      return { success: false, error: `Unsupported channel: ${channel}` }
  }
}
