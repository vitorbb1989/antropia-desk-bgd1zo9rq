import { createContext, useContext, useState, ReactNode } from 'react'
import { Attachment } from '@/types'
import { supabase } from '@/lib/supabase/client'
import useAuthStore from './useAuthStore'
import { toast } from 'sonner'

interface UploadProgress {
  [key: string]: {
    progress: number // 0-100
    status: 'PENDING' | 'UPLOADING' | 'SUCCESS' | 'FAILED'
    error?: string
  }
}

interface TicketMeta {
  total: number
  hasMore: boolean
  nextPage: number
  isLoaded: boolean
  lastSearch?: string
}

interface AttachmentContextType {
  attachments: Attachment[]
  uploadProgress: UploadProgress
  ticketMeta: Record<string, TicketMeta>
  isLoading: boolean
  uploadFile: (file: File, ticketId: string) => Promise<Attachment | null>
  deleteAttachment: (attachmentId: string) => Promise<void>
  getSignedUrl: (attachmentId: string) => Promise<string | null>
  getAttachmentsByTicket: (ticketId: string, search?: string) => Attachment[]
  fetchAttachments: (
    ticketId: string,
    page?: number,
    pageSize?: number,
    search?: string,
  ) => Promise<void>
  resetUploadProgress: (fileId: string) => void
}

const AttachmentContext = createContext<AttachmentContextType | null>(null)

const BUCKET = 'anexos'

function mapRow(row: any): Attachment {
  return {
    id: row.id,
    organizationId: row.organization_id,
    ticketId: row.ticket_id,
    name: row.file_name,
    type: row.mime_type,
    size: row.file_size,
    storagePath: row.storage_path,
    storageBucket: row.storage_bucket,
    extension: row.file_ext,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
    deletedBy: row.deleted_by,
  }
}

export function AttachmentProvider({ children }: { children: ReactNode }) {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({})
  const [ticketMeta, setTicketMeta] = useState<Record<string, TicketMeta>>({})
  const [isLoading, setIsLoading] = useState(false)

  const { user } = useAuthStore()

  const resetUploadProgress = (fileId: string) => {
    setUploadProgress((prev) => {
      const next = { ...prev }
      delete next[fileId]
      return next
    })
  }

  const fetchAttachments = async (
    ticketId: string,
    page = 1,
    pageSize = 10,
    search = '',
  ) => {
    setIsLoading(true)
    try {
      let query = supabase
        .from('attachments')
        .select('*', { count: 'exact' })
        .eq('ticket_id', ticketId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (search) {
        const safe = search.replace(/[%_\\]/g, '\\$&')
        query = query.ilike('file_name', `%${safe}%`)
      }

      const start = (page - 1) * pageSize
      query = query.range(start, start + pageSize - 1)

      const { data, count, error } = await query
      if (error) throw error

      const mapped = (data || []).map(mapRow)
      const total = count || 0
      const hasMore = start + pageSize < total

      setAttachments((prev) => {
        const existingIds = new Set(prev.map((a) => a.id))
        const newItems = mapped.filter((a) => !existingIds.has(a.id))
        return [...prev, ...newItems].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
      })

      setTicketMeta((prev) => ({
        ...prev,
        [ticketId]: {
          total,
          hasMore,
          nextPage: page + 1,
          isLoaded: true,
          lastSearch: search,
        },
      }))
    } catch (error) {
      console.error('Failed to fetch attachments', error)
      toast.error('Erro ao carregar anexos')
    } finally {
      setIsLoading(false)
    }
  }

  const uploadFile = async (
    file: File,
    ticketId: string,
  ): Promise<Attachment | null> => {
    if (!user) {
      toast.error('Usuário não autenticado')
      return null
    }

    const organizationId = user.companyId
    const tempId = `${file.name}-${file.size}`

    setUploadProgress((prev) => ({
      ...prev,
      [tempId]: { progress: 0, status: 'PENDING' },
    }))

    try {
      const fileUuid = crypto.randomUUID()
      const fileExt = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
      const storagePath = `org/${organizationId}/ticket/${ticketId}/${fileUuid}.${fileExt}`

      setUploadProgress((prev) => ({
        ...prev,
        [tempId]: { progress: 20, status: 'UPLOADING' },
      }))

      // 1. Upload to Supabase Storage
      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, { contentType: file.type, upsert: false })

      if (uploadErr) throw uploadErr

      setUploadProgress((prev) => ({
        ...prev,
        [tempId]: { progress: 70, status: 'UPLOADING' },
      }))

      // 2. Insert record in database
      const { data: row, error: dbErr } = await supabase
        .from('attachments')
        .insert({
          id: fileUuid,
          organization_id: organizationId,
          ticket_id: ticketId,
          file_name: file.name,
          mime_type: file.type,
          file_size: file.size,
          storage_path: storagePath,
          storage_bucket: BUCKET,
          file_ext: fileExt,
          uploaded_by: user.id,
        })
        .select()
        .single()

      if (dbErr) {
        // Rollback: remove uploaded file
        await supabase.storage.from(BUCKET).remove([storagePath])
        throw dbErr
      }

      const newAttachment = mapRow(row)

      setAttachments((prev) => [newAttachment, ...prev])

      setTicketMeta((prev) => {
        const meta = prev[ticketId] || {
          total: 0,
          hasMore: false,
          nextPage: 1,
          isLoaded: true,
        }
        return {
          ...prev,
          [ticketId]: { ...meta, total: meta.total + 1 },
        }
      })

      setUploadProgress((prev) => ({
        ...prev,
        [tempId]: { progress: 100, status: 'SUCCESS' },
      }))

      return newAttachment
    } catch (error: any) {
      console.error('Upload failed:', error)

      setUploadProgress((prev) => ({
        ...prev,
        [tempId]: { progress: 0, status: 'FAILED', error: error.message },
      }))

      return null
    }
  }

  const deleteAttachment = async (attachmentId: string) => {
    if (!user) return

    const attachment = attachments.find((a) => a.id === attachmentId)
    if (!attachment) return

    let canDelete = false
    if (user.role === 'ADMIN' || user.role === 'AGENT') {
      canDelete = true
    } else if (user.role === 'USER') {
      if (attachment.uploadedBy === user.id) {
        canDelete = true
      }
    }

    if (!canDelete) {
      toast.error('Você não tem permissão para remover este anexo.')
      return
    }

    if (confirm('Tem certeza que deseja remover este anexo?')) {
      // Soft delete in database
      const { error } = await supabase
        .from('attachments')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user.id,
        })
        .eq('id', attachmentId)

      if (error) {
        toast.error('Erro ao remover anexo.')
        return
      }

      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId))

      setTicketMeta((prev) => {
        const ticketId = attachment.ticketId
        const meta = prev[ticketId]
        if (!meta) return prev
        return {
          ...prev,
          [ticketId]: {
            ...meta,
            total: Math.max(0, meta.total - 1),
          },
        }
      })

      toast.success('Anexo removido com sucesso.')
    }
  }

  const getSignedUrl = async (attachmentId: string): Promise<string | null> => {
    const attachment = attachments.find((a) => a.id === attachmentId)
    if (!attachment || attachment.deletedAt) return null

    const { data, error } = await supabase.storage
      .from(attachment.storageBucket)
      .createSignedUrl(attachment.storagePath, 60)

    if (error) {
      console.error('Error creating signed URL:', error)
      return null
    }

    return data.signedUrl
  }

  const getAttachmentsByTicket = (ticketId: string, search = '') => {
    let items = attachments.filter(
      (a) => a.ticketId === ticketId && !a.deletedAt,
    )
    if (search) {
      const lower = search.toLowerCase()
      items = items.filter((a) => a.name.toLowerCase().includes(lower))
    }
    return items
  }

  return (
    <AttachmentContext.Provider
      value={{
        attachments,
        uploadProgress,
        ticketMeta,
        isLoading,
        uploadFile,
        deleteAttachment,
        getSignedUrl,
        getAttachmentsByTicket,
        fetchAttachments,
        resetUploadProgress,
      }}
    >
      {children}
    </AttachmentContext.Provider>
  )
}

const useAttachmentStore = () => {
  const context = useContext(AttachmentContext)
  if (!context)
    throw new Error('useAttachmentStore must be used within AttachmentProvider')
  return context
}

export default useAttachmentStore
