import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  UploadCloud,
  X,
  FileText,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import useAttachmentStore from '@/stores/useAttachmentStore'
import useSettingsStore from '@/stores/useSettingsStore'
import { toast } from 'sonner'
import { Attachment } from '@/types'

interface AttachmentUploadProps {
  ticketId: string
  onUploadComplete?: (attachment: Attachment) => void
  onRemove?: (attachmentId: string) => void
  existingAttachments?: Attachment[]
}

// Helper to keep track of files that failed or are pending locally
interface LocalFile {
  id: string // tempId
  file: File
}

export function AttachmentUpload({
  ticketId,
  onUploadComplete,
  onRemove,
  existingAttachments = [],
}: AttachmentUploadProps) {
  const { uploadFile, uploadProgress, resetUploadProgress } =
    useAttachmentStore()
  const { settings } = useSettingsStore()
  const [isDragOver, setIsDragOver] = useState(false)
  const [localFiles, setLocalFiles] = useState<LocalFile[]>([])

  const handleUpload = async (file: File) => {
    const tempId = `${file.name}-${file.size}`

    // Add to local tracking if not exists
    setLocalFiles((prev) => {
      if (prev.find((f) => f.id === tempId)) return prev
      return [...prev, { id: tempId, file }]
    })

    const attachment = await uploadFile(file, ticketId)
    if (attachment && onUploadComplete) {
      onUploadComplete(attachment)
      // Remove from local files on success to clean up
      setLocalFiles((prev) => prev.filter((f) => f.id !== tempId))
    }
  }

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      for (const file of acceptedFiles) {
        // Validation per User Story and Settings
        const sizeInMB = file.size / (1024 * 1024)
        if (sizeInMB > settings.maxFileSize) {
          toast.error(
            `Arquivo ${file.name} excedeu o tamanho máximo de ${settings.maxFileSize} MB.`,
          )
          continue
        }

        const extension = file.name.split('.').pop()?.toLowerCase() || ''
        if (!settings.allowedFileTypes.includes(extension)) {
          toast.error(
            `Tipo de arquivo não permitido (${extension}). Aceitos: ${settings.allowedFileTypes.join(', ')}`,
          )
          continue
        }

        await handleUpload(file)
      }
    },
    [ticketId, settings, handleUpload],
  )

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    onDragEnter: () => setIsDragOver(true),
    onDragLeave: () => setIsDragOver(false),
    onDropAccepted: () => setIsDragOver(false),
  })

  const handleRetry = (fileId: string) => {
    const localFile = localFiles.find((f) => f.id === fileId)
    if (localFile) {
      handleUpload(localFile.file)
    } else {
      toast.error('Arquivo original perdido. Por favor, selecione novamente.')
    }
  }

  const handleClear = (fileId: string) => {
    resetUploadProgress(fileId)
    setLocalFiles((prev) => prev.filter((f) => f.id !== fileId))
  }

  // Combine active progress with any lingering failures we know about
  const progressEntries = Object.entries(uploadProgress).filter(
    ([key, data]) => {
      // Show if pending, uploading, or failed.
      // Hide success after a short delay (handled by parent mostly, but we filter here)
      return data.status !== 'SUCCESS'
    },
  )

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-xl p-6 transition-all duration-300 cursor-pointer text-center flex flex-col items-center justify-center gap-2 group',
          isDragOver
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : 'border-border hover:border-primary/50 hover:bg-secondary/50',
        )}
      >
        <input {...getInputProps()} />
        <div className="h-12 w-12 rounded-full bg-secondary group-hover:bg-primary/10 transition-colors flex items-center justify-center text-muted-foreground group-hover:text-primary">
          <UploadCloud className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">
            Arraste arquivos ou clique para selecionar
          </p>
          <p className="text-xs text-muted-foreground">
            Máx. {settings.maxFileSize}MB (
            {settings.allowedFileTypes.join(', ').toUpperCase()})
          </p>
        </div>
      </div>

      {/* Upload Progress List */}
      {progressEntries.length > 0 && (
        <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
          {progressEntries.map(([key, data]) => {
            const fileName = key.split('-')[0] // simplistic name extraction
            return (
              <div
                key={key}
                className={cn(
                  'flex items-center gap-3 p-3 border rounded-lg shadow-sm transition-all',
                  data.status === 'FAILED'
                    ? 'bg-red-50 border-red-100'
                    : 'bg-white border-border/60',
                )}
              >
                <div
                  className={cn(
                    'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
                    data.status === 'FAILED'
                      ? 'bg-red-100 text-red-500'
                      : 'bg-secondary text-muted-foreground',
                  )}
                >
                  {data.status === 'FAILED' ? (
                    <AlertCircle className="h-4 w-4" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-medium truncate max-w-[180px] text-foreground">
                      {fileName}
                    </span>
                    <span
                      className={cn(
                        'uppercase font-bold text-[10px]',
                        data.status === 'FAILED'
                          ? 'text-destructive'
                          : 'text-primary',
                      )}
                    >
                      {data.status === 'FAILED'
                        ? 'Falha'
                        : `${data.progress.toFixed(0)}%`}
                    </span>
                  </div>

                  <Progress
                    value={data.progress}
                    className={cn(
                      'h-1.5',
                      data.status === 'FAILED' && 'bg-red-200',
                      data.status === 'FAILED' ? '[&>div]:bg-red-500' : '',
                    )}
                  />

                  {data.error && (
                    <p className="text-[10px] text-destructive font-medium truncate">
                      {data.error}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {data.status === 'FAILED' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-primary"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRetry(key)
                      }}
                      title="Tentar novamente"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleClear(key)
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Completed Attachments List (Preview) */}
      {existingAttachments.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
          {existingAttachments.map((att) => (
            <div
              key={att.id}
              className="relative group border border-border rounded-lg p-2 flex items-center gap-2 bg-secondary/10 hover:bg-secondary/30 transition-colors"
            >
              <div className="h-8 w-8 shrink-0 rounded bg-white flex items-center justify-center border shadow-sm overflow-hidden">
                {att.type.startsWith('image/') ? (
                  <img
                    src={att.url}
                    className="h-full w-full object-cover"
                    alt=""
                  />
                ) : (
                  <FileText className="h-4 w-4 text-blue-500" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate" title={att.name}>
                  {att.name}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {(att.size / 1024).toFixed(0)} KB
                </p>
              </div>
              {onRemove && (
                <button
                  onClick={() => onRemove(att.id)}
                  className="absolute -top-2 -right-2 h-6 w-6 bg-background border rounded-full flex items-center justify-center shadow-sm text-muted-foreground hover:text-destructive hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
