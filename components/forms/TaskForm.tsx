'use client'

import { useState, useEffect, useRef } from 'react'
import { ExternalLink, ImagePlus, Loader2, Trash2, X } from 'lucide-react'
import {
  MAX_TASK_ATTACHMENT_BYTES,
  MAX_TASK_ATTACHMENT_LABEL,
  MAX_TASK_ATTACHMENTS,
  TASK_ATTACHMENT_MIME_TYPES,
  type TaskAttachment,
} from '@/lib/taskAttachmentTypes'

const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

async function prepareTaskImage(file: File) {
  if (file.size <= MAX_TASK_ATTACHMENT_BYTES) return file
  if (file.type === 'image/gif' || typeof createImageBitmap !== 'function') {
    throw new Error(`${file.name} is too large. Each image must be ${MAX_TASK_ATTACHMENT_LABEL} or smaller`)
  }

  const bitmap = await createImageBitmap(file)
  const maxDimension = 2400
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    throw new Error(`Could not prepare ${file.name}`)
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const makeBlob = (quality: number) => new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality))
  let compressed: Blob | null = null
  for (const quality of [0.86, 0.74, 0.62, 0.5]) {
    compressed = await makeBlob(quality)
    if (compressed && compressed.size <= MAX_TASK_ATTACHMENT_BYTES) break
  }
  if (!compressed || compressed.size > MAX_TASK_ATTACHMENT_BYTES) {
    throw new Error(`${file.name} is too large. Please choose a smaller image`)
  }
  const baseName = file.name.replace(/\.[^.]+$/, '').slice(0, 220) || 'reference'
  return new File([compressed], `${baseName}.webp`, { type: 'image/webp', lastModified: file.lastModified })
}

interface TaskFormProps {
  onSuccess: () => void
  clients: { id: string; company_name: string }[]
  profiles: { id: string; full_name: string | null; email: string | null }[]
  initialData?: Record<string, unknown>
  /** Members may only change the status of a task already assigned to them. */
  statusOnly?: boolean
}

export default function TaskForm({ onSuccess, clients, profiles, initialData, statusOnly }: TaskFormProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [projects, setProjects] = useState<{ id: string; name: string; client_id: string | null }[]>([])
  const [attachments, setAttachments] = useState<TaskAttachment[]>(
    Array.isArray(initialData?.attachments) ? initialData.attachments as TaskAttachment[] : [],
  )
  const [pendingImages, setPendingImages] = useState<{ file: File; preview: string }[]>([])
  const [preparingImages, setPreparingImages] = useState(false)
  const [removingId, setRemovingId] = useState('')
  const [persistedTaskId, setPersistedTaskId] = useState((initialData?.id as string) ?? '')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingImagesRef = useRef(pendingImages)
  const [form, setForm] = useState({
    title: (initialData?.title as string) ?? '',
    description: (initialData?.description as string) ?? '',
    client_id: (initialData?.client_id as string) ?? '',
    project_id: (initialData?.project_id as string) ?? '',
    assigned_to: (initialData?.assigned_to as string) ?? '',
    priority: (initialData?.priority as string) ?? 'medium',
    status: (initialData?.status as string) ?? 'todo',
    due_date: (initialData?.due_date as string) ?? '',
  })

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(d => setProjects(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  useEffect(() => { pendingImagesRef.current = pendingImages }, [pendingImages])
  useEffect(() => () => {
    pendingImagesRef.current.forEach(image => URL.revokeObjectURL(image.preview))
  }, [])

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const addImages = async (files: FileList | File[]) => {
    const chosen = Array.from(files)
    setError('')
    if (attachments.length + pendingImages.length + chosen.length > MAX_TASK_ATTACHMENTS) {
      setError(`You can attach up to ${MAX_TASK_ATTACHMENTS} reference images to a task`)
      return
    }
    const invalidType = chosen.find(file => !TASK_ATTACHMENT_MIME_TYPES.includes(file.type as typeof TASK_ATTACHMENT_MIME_TYPES[number]))
    if (invalidType) {
      setError('Use JPG, PNG, GIF, or WebP images')
      return
    }
    setPreparingImages(true)
    try {
      const prepared = await Promise.all(chosen.map(prepareTaskImage))
      setPendingImages(current => [
        ...current,
        ...prepared.map(file => ({ file, preview: URL.createObjectURL(file) })),
      ])
    } catch (imageError) {
      setError(imageError instanceof Error ? imageError.message : 'Could not prepare the selected image')
    } finally {
      setPreparingImages(false)
    }
  }

  const removePendingImage = (index: number) => {
    setPendingImages(current => {
      if (current[index]) URL.revokeObjectURL(current[index].preview)
      return current.filter((_, itemIndex) => itemIndex !== index)
    })
  }

  const removeAttachment = async (attachment: TaskAttachment) => {
    if (!persistedTaskId || !confirm(`Remove ${attachment.file_name} from this task?`)) return
    setRemovingId(attachment.id)
    setError('')
    try {
      const response = await fetch(`/api/tasks/${persistedTaskId}/attachments/${attachment.id}`, { method: 'DELETE' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Could not remove the image')
      setAttachments(current => current.filter(item => item.id !== attachment.id))
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Could not remove the image')
    } finally {
      setRemovingId('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const payload = {
      ...form,
      client_id: form.client_id || null,
      project_id: form.project_id || null,
      assigned_to: form.assigned_to || null,
      due_date: form.due_date || null,
      description: form.description || null,
    }
    const id = persistedTaskId || undefined
    const url = id ? `/api/tasks/${id}` : '/api/tasks'
    const method = id ? 'PUT' : 'POST'

    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(statusOnly ? { status: form.status } : payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong')

      const taskId = id ?? data.id
      if (!taskId) throw new Error('The task was saved, but its images could not be attached')
      if (!id) setPersistedTaskId(taskId)

      if (!statusOnly && pendingImages.length) {
        const remaining = [...pendingImages]
        while (remaining.length) {
          const current = remaining[0]
          const body = new FormData()
          body.append('file', current.file)
          const upload = await fetch(`/api/tasks/${taskId}/attachments`, { method: 'POST', body })
          const uploaded = await upload.json().catch(() => ({}))
          if (!upload.ok) {
            setPendingImages(remaining)
            throw new Error(`Task saved, but ${current.file.name} could not be attached: ${uploaded.error ?? 'upload failed'}`)
          }
          URL.revokeObjectURL(current.preview)
          setAttachments(existing => [...existing, uploaded as TaskAttachment])
          remaining.shift()
          setPendingImages([...remaining])
        }
      }

      onSuccess()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const imageGallery = attachments.length > 0 && (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {attachments.map(attachment => (
        <div key={attachment.id} className="relative overflow-hidden rounded-lg border border-sand-300 bg-paper-50 group aspect-[4/3]">
          {attachment.signed_url ? (
            <a href={attachment.signed_url} target="_blank" rel="noreferrer" className="block w-full h-full" title={`Open ${attachment.file_name}`}>
              <img src={attachment.signed_url} alt={attachment.file_name} loading="lazy" className="w-full h-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-black/60 px-2 py-1 text-[10px] text-white truncate">
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{attachment.file_name}</span>
              </span>
            </a>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-taupe-500 px-3 text-center">Preview unavailable</div>
          )}
          {!statusOnly && (
            <button
              type="button"
              onClick={() => removeAttachment(attachment)}
              disabled={removingId === attachment.id}
              className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-white/95 text-red-600 shadow flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
              aria-label={`Remove ${attachment.file_name}`}
            >
              {removingId === attachment.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      ))}
    </div>
  )

  if (statusOnly) {
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">{form.title}</p>
          {form.description && <p className="text-sm text-gray-500 mt-1 whitespace-pre-wrap">{form.description}</p>}
        </div>
        {imageGallery && (
          <div>
            <p className={labelClass}>Reference images</p>
            {imageGallery}
          </div>
        )}
        <div>
          <label className={labelClass}>Status</label>
          <select className={inputClass} value={form.status} onChange={set('status')}>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
          </select>
        </div>
        {error && <p className="text-red-500 text-sm" role="alert">{error}</p>}
        <button type="submit" className="btn-primary w-full justify-center" disabled={saving}>
          {saving ? 'Saving…' : 'Update Status'}
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>Title *</label>
        <input className={inputClass} value={form.title} onChange={set('title')} required />
      </div>

      <div>
        <label className={labelClass}>Description</label>
        <textarea className={inputClass} rows={3} value={form.description} onChange={set('description')} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium text-gray-700">Reference images</label>
          <span className="text-xs text-taupe-500">{attachments.length + pendingImages.length}/{MAX_TASK_ATTACHMENTS}</span>
        </div>
        {imageGallery}
        {pendingImages.length > 0 && (
          <div className={`grid grid-cols-2 sm:grid-cols-3 gap-2 ${attachments.length ? 'mt-2' : ''}`}>
            {pendingImages.map((image, index) => (
              <div key={`${image.file.name}-${image.file.lastModified}-${index}`} className="relative overflow-hidden rounded-lg border-2 border-dashed border-brand-300 bg-brand-50 aspect-[4/3] group">
                <img src={image.preview} alt={image.file.name} className="w-full h-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 bg-brand-700/80 px-2 py-1 text-[10px] text-white truncate">Ready to upload · {image.file.name}</span>
                <button type="button" onClick={() => removePendingImage(index)} className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-white/95 text-red-600 shadow flex items-center justify-center" aria-label={`Remove ${image.file.name}`}>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        {attachments.length + pendingImages.length < MAX_TASK_ATTACHMENTS && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={preparingImages}
            className="mt-2 w-full rounded-lg border border-dashed border-sand-400 px-4 py-4 text-sm text-taupe-600 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 transition-colors flex items-center justify-center gap-2"
          >
            {preparingImages ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
            {preparingImages ? 'Preparing image…' : 'Add reference image'}
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={TASK_ATTACHMENT_MIME_TYPES.join(',')}
          multiple
          onChange={event => {
            if (event.target.files) void addImages(event.target.files)
            event.target.value = ''
          }}
        />
        <p className="text-xs text-taupe-500 mt-1.5">JPG, PNG, GIF, or WebP · up to {MAX_TASK_ATTACHMENT_LABEL} each</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Client</label>
          <select className={inputClass} value={form.client_id} onChange={set('client_id')}>
            <option value="">None</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.company_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Project</label>
          <select className={inputClass} value={form.project_id} onChange={set('project_id')}>
            <option value="">None</option>
            {(form.client_id ? projects.filter(p => !p.client_id || p.client_id === form.client_id) : projects).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Assigned To</label>
          <select className={inputClass} value={form.assigned_to} onChange={set('assigned_to')}>
            <option value="">Unassigned</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Priority</label>
          <select className={inputClass} value={form.priority} onChange={set('priority')}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Status</label>
          <select className={inputClass} value={form.status} onChange={set('status')}>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Due Date</label>
          <input className={inputClass} type="date" value={form.due_date} onChange={set('due_date')} />
        </div>
      </div>

      {error && <p className="text-red-500 text-sm" role="alert">{error}</p>}

      <button type="submit" className="btn-primary w-full justify-center" disabled={saving}>
        {saving ? 'Saving…' : persistedTaskId ? 'Update Task' : 'Create Task'}
      </button>
    </form>
  )
}
