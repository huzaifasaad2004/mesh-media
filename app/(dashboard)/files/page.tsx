'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Upload, ExternalLink, FolderOpen, FileText, Image as ImageIcon, Film, Table2, Download, Trash2, Loader2, History, RefreshCw } from 'lucide-react'
import { MAX_DIRECT_UPLOAD_BYTES, MAX_DIRECT_UPLOAD_LABEL } from '@/lib/uploadLimits'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { formatDate } from '@/lib/utils'

const fileIcon = (type: string | null) => {
  if (!type) return FileText
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(type)) return ImageIcon
  if (['mp4', 'mov', 'avi'].includes(type)) return Film
  if (['xlsx', 'csv'].includes(type)) return Table2
  return FileText
}

const categoryColors: Record<string, string> = {
  contract:  'bg-brand-100 text-brand-700',
  creative:  'bg-pink-100 text-pink-700',
  report:    'bg-[#E6E9EE] text-[#4A5A6E]',
  invoice:   'bg-green-100 text-green-700',
  other:     'bg-gray-100 text-gray-600',
}

// Categories that are typically client deliverables default to visible in
// the portal; internal-facing categories default to hidden. Always overridable.
const DEFAULT_VISIBLE: Record<string, boolean> = {
  creative: true, report: true, contract: false, invoice: false, other: false,
}

const formatSize = (bytes: number) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`

const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function UploadForm({ clients, onSuccess }: { clients: { id: string; company_name: string }[]; onSuccess: () => void }) {
  const [mode, setMode] = useState<'upload' | 'drive'>('upload')
  const [name, setName] = useState('')
  const [clientId, setClientId] = useState('')
  const [category, setCategory] = useState('other')
  const [clientVisible, setClientVisible] = useState(false)
  const [driveUrl, setDriveUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const changeCategory = (c: string) => { setCategory(c); setClientVisible(DEFAULT_VISIBLE[c] ?? false) }
  const pickFile = (f: File) => {
    if (f.size > MAX_DIRECT_UPLOAD_BYTES) { setError(`That file is too large for direct upload (max ${MAX_DIRECT_UPLOAD_LABEL}) — link a Drive file instead`); return }
    setError('')
    setFile(f)
    if (!name) setName(f.name)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (mode === 'upload' && !file) { setError('Choose a file to upload'); return }
    if (mode === 'drive' && !driveUrl.trim()) { setError('Paste a Drive link'); return }
    setSaving(true)
    try {
      const body: Record<string, unknown> = { name: name.trim(), client_id: clientId || null, category, client_visible: clientVisible }
      if (mode === 'upload' && file) {
        body.file_base64 = await fileToBase64(file)
        body.file_name = file.name
        body.mime_type = file.type
      } else {
        body.drive_url = driveUrl.trim()
      }
      const res = await fetch('/api/files', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Upload failed')
      onSuccess()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex gap-2 text-xs">
        <button type="button" onClick={() => setMode('upload')} className={`px-2.5 py-1.5 rounded-md ${mode === 'upload' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}>Upload file (under 3MB)</button>
        <button type="button" onClick={() => setMode('drive')} className={`px-2.5 py-1.5 rounded-md ${mode === 'drive' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}>Link a Drive file</button>
      </div>

      {mode === 'upload' ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) pickFile(f) }}
          className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-brand-300 hover:bg-brand-50 transition-colors"
        >
          <FolderOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-600">{file ? file.name : 'Drag & drop, or click to choose a file'}</p>
          {file && <p className="text-xs text-gray-400 mt-1">{formatSize(file.size)}</p>}
          <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f) }} />
        </div>
      ) : (
        <div>
          <label className={labelClass}>Drive link</label>
          <input className={inputClass} type="url" placeholder="https://drive.google.com/…" value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} />
        </div>
      )}

      <div>
        <label className={labelClass}>File name</label>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Client</label>
          <select className={inputClass} value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Unassigned</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Category</label>
          <select className={inputClass} value={category} onChange={(e) => changeCategory(e.target.value)}>
            <option value="contract">Contract</option>
            <option value="creative">Creative</option>
            <option value="report">Report</option>
            <option value="invoice">Invoice</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      {clientId && (
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={clientVisible} onChange={(e) => setClientVisible(e.target.checked)} />
          Show in the client&apos;s portal
        </label>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button type="submit" className="btn-primary w-full justify-center" disabled={saving}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} {saving ? 'Saving…' : 'Save File'}
      </button>
    </form>
  )
}

function ReplaceForm({ file, onSuccess }: { file: any; onSuccess: () => void }) {
  const [mode, setMode] = useState<'upload' | 'drive'>('upload')
  const [driveUrl, setDriveUrl] = useState('')
  const [pickedFile, setPickedFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const pickFile = (f: File) => {
    if (f.size > MAX_DIRECT_UPLOAD_BYTES) { setError(`That file is too large for direct upload (max ${MAX_DIRECT_UPLOAD_LABEL}) — link a Drive file instead`); return }
    setError('')
    setPickedFile(f)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (mode === 'upload' && !pickedFile) { setError('Choose a file to upload'); return }
    if (mode === 'drive' && !driveUrl.trim()) { setError('Paste a Drive link'); return }
    setSaving(true)
    try {
      const body: Record<string, unknown> = {}
      if (mode === 'upload' && pickedFile) {
        body.file_base64 = await fileToBase64(pickedFile)
        body.file_name = pickedFile.name
        body.mime_type = pickedFile.type
      } else {
        body.drive_url = driveUrl.trim()
      }
      const res = await fetch(`/api/files/${file.id}/versions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Upload failed')
      onSuccess()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-gray-500">
        Replacing <strong>{file.name}</strong> (currently v{file.version}). The old version stays in its history — nothing is deleted.
      </p>
      <div className="flex gap-2 text-xs">
        <button type="button" onClick={() => setMode('upload')} className={`px-2.5 py-1.5 rounded-md ${mode === 'upload' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}>Upload file (under 3MB)</button>
        <button type="button" onClick={() => setMode('drive')} className={`px-2.5 py-1.5 rounded-md ${mode === 'drive' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}>Link a Drive file</button>
      </div>
      {mode === 'upload' ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) pickFile(f) }}
          className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-brand-300 hover:bg-brand-50 transition-colors"
        >
          <FolderOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-600">{pickedFile ? pickedFile.name : 'Drag & drop, or click to choose a file'}</p>
          {pickedFile && <p className="text-xs text-gray-400 mt-1">{formatSize(pickedFile.size)}</p>}
          <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f) }} />
        </div>
      ) : (
        <div>
          <label className={labelClass}>Drive link</label>
          <input className={inputClass} type="url" placeholder="https://drive.google.com/…" value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} />
        </div>
      )}
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button type="submit" className="btn-primary w-full justify-center" disabled={saving}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} {saving ? 'Uploading…' : `Save as v${file.version + 1}`}
      </button>
    </form>
  )
}

function VersionHistory({ file }: { file: any }) {
  const [versions, setVersions] = useState<any[] | null>(null)

  useEffect(() => {
    fetch(`/api/files/${file.id}/versions`).then(r => r.json()).then(setVersions)
  }, [file.id])

  if (!versions) return <p className="text-sm text-gray-400 py-4 text-center">Loading…</p>

  return (
    <div className="divide-y divide-gray-50 -mx-1">
      {versions.map((v) => (
        <div key={v.id} className="px-1 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-900">v{v.version}{v.id === file.id && <span className="text-xs text-brand-600 ml-1.5">(current)</span>}</p>
            <p className="text-xs text-gray-400">
              {v.uploader?.full_name ?? 'Unknown'} · {formatDate(v.created_at)}
              {v.file_size ? ` · ${formatSize(v.file_size)}` : v.drive_url ? ' · Drive link' : ''}
            </p>
          </div>
          {v.storage_path && (
            <a href={`/api/files/${v.id}/download`} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">
              <Download className="w-3.5 h-3.5" /> Download
            </a>
          )}
          {v.drive_url && (
            <a href={v.drive_url} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">
              <ExternalLink className="w-3.5 h-3.5" /> Open
            </a>
          )}
        </div>
      ))}
    </div>
  )
}

export default function FilesPage() {
  const [files, setFiles] = useState<any[]>([])
  const [clients, setClients] = useState<{ id: string; company_name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [replacingFile, setReplacingFile] = useState<any | null>(null)
  const [historyFile, setHistoryFile] = useState<any | null>(null)
  const toast = useToast()

  const load = useCallback(async () => {
    const [fRes, cRes] = await Promise.all([fetch('/api/files'), fetch('/api/clients')])
    const [fData, cData] = await Promise.all([fRes.json(), cRes.json()])
    setFiles(Array.isArray(fData) ? fData : [])
    setClients(Array.isArray(cData) ? cData : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const deleteFile = async (id: string) => {
    if (!confirm('Delete this file?')) return
    const res = await fetch(`/api/files/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('File deleted'); load() }
    else toast.error('Failed to delete file')
  }

  const grouped = files.reduce((acc: Record<string, any[]>, file: any) => {
    const key = file.client?.company_name ?? 'Unassigned'
    if (!acc[key]) acc[key] = []
    acc[key].push(file)
    return acc
  }, {})

  const totalSize = files.reduce((sum, f) => sum + (f.file_size ?? 0), 0)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Files</h1>
          <p className="text-gray-500 text-sm mt-0.5">{files.length} files · {formatSize(totalSize)} total</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Upload className="w-4 h-4" /> Upload File
        </button>
      </div>

      <div
        onClick={() => setShowModal(true)}
        className="card border-dashed border-2 border-gray-200 bg-gray-50 p-10 text-center mb-6 hover:border-brand-300 hover:bg-brand-50 transition-colors cursor-pointer"
      >
        <FolderOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-500">Click to upload a file or link a Drive file</p>
        <p className="text-xs text-gray-400 mt-1">Attach to any client, direct upload up to 3MB (larger files: link a Drive file instead)</p>
      </div>

      {loading ? (
        <div className="card px-5 py-16 text-center text-gray-400 text-sm">Loading…</div>
      ) : Object.keys(grouped).length > 0 ? (
        <div className="space-y-5">
          {Object.entries(grouped).map(([clientName, clientFiles]) => (
            <div key={clientName} className="card overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-semibold text-gray-700">{clientName}</span>
                <span className="text-xs text-gray-400 ml-1">({clientFiles.length} files)</span>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-50">
                  {clientFiles.map((file: any) => {
                    const Icon = fileIcon(file.file_type)
                    return (
                      <tr key={file.id} className="table-row">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                              <Icon className="w-4 h-4 text-gray-500" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {file.name}
                                {file.version > 1 && (
                                  <button onClick={() => setHistoryFile(file)} className="ml-1.5 text-xs text-brand-600 hover:underline">v{file.version}</button>
                                )}
                              </p>
                              <p className="text-xs text-gray-400">
                                {file.file_size ? formatSize(file.file_size) : file.drive_url ? 'Drive link' : ''}
                                {file.client_visible && <span className="ml-1.5 text-brand-500">· portal-visible</span>}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          {file.category && (
                            <span className={`badge ${categoryColors[file.category] ?? 'bg-gray-100 text-gray-600'}`}>
                              {file.category}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-gray-400 text-xs">{formatDate(file.created_at)}</td>
                        <td className="px-5 py-3 text-gray-400 text-xs">{file.uploader?.full_name ?? '—'}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            {file.drive_url && (
                              <a href={file.drive_url} target="_blank" rel="noopener noreferrer" className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-brand-600 hover:bg-brand-50" title="Open in Drive">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                            {file.storage_path && (
                              <a href={`/api/files/${file.id}/download`} target="_blank" rel="noopener noreferrer" className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-brand-600 hover:bg-brand-50" title="Download">
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <button onClick={() => setHistoryFile(file)} className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-brand-600 hover:bg-brand-50" title="Version history">
                              <History className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setReplacingFile(file)} className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-brand-600 hover:bg-brand-50" title="Upload a new version">
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => deleteFile(file.id)} className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50" title="Delete">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-16 text-center">
          <FolderOpen className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No files uploaded yet</p>
          <p className="text-gray-300 text-xs mt-1">Upload files and assign them to clients</p>
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Upload File">
        <UploadForm clients={clients} onSuccess={() => { setShowModal(false); load() }} />
      </Modal>

      <Modal isOpen={!!replacingFile} onClose={() => setReplacingFile(null)} title="Upload New Version">
        {replacingFile && <ReplaceForm file={replacingFile} onSuccess={() => { setReplacingFile(null); toast.success('New version uploaded'); load() }} />}
      </Modal>

      <Modal isOpen={!!historyFile} onClose={() => setHistoryFile(null)} title={historyFile ? `Version History — ${historyFile.name}` : 'Version History'}>
        {historyFile && <VersionHistory file={historyFile} />}
      </Modal>
    </div>
  )
}
