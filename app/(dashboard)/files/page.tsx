import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import { Upload, ExternalLink, FolderOpen, FileText, Image, Film, Table2 } from 'lucide-react'

const fileIcon = (type: string | null) => {
  if (!type) return FileText
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(type)) return Image
  if (['mp4', 'mov', 'avi'].includes(type)) return Film
  if (['xlsx', 'csv'].includes(type)) return Table2
  return FileText
}

const categoryColors: Record<string, string> = {
  contract:  'bg-purple-100 text-purple-700',
  creative:  'bg-pink-100 text-pink-700',
  report:    'bg-blue-100 text-blue-700',
  invoice:   'bg-green-100 text-green-700',
  other:     'bg-gray-100 text-gray-600',
}

export default async function FilesPage() {
  const supabase = createClient()
  const { data: files } = await supabase
    .from('files')
    .select('*, client:clients(id, company_name), uploader:profiles(full_name)')
    .order('created_at', { ascending: false })

  const { data: clients } = await supabase
    .from('clients')
    .select('id, company_name')
    .order('company_name')

  // Group files by client
  const grouped = (files ?? []).reduce((acc: Record<string, any[]>, file: any) => {
    const key = file.client?.company_name ?? 'Unassigned'
    if (!acc[key]) acc[key] = []
    acc[key].push(file)
    return acc
  }, {})

  const totalSize = (files ?? []).reduce((sum: number, f: any) => sum + (f.file_size ?? 0), 0)
  const formatSize = (bytes: number) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Files</h1>
          <p className="text-gray-500 text-sm mt-0.5">{files?.length ?? 0} files · {formatSize(totalSize)} total</p>
        </div>
        <button className="btn-primary">
          <Upload className="w-4 h-4" /> Upload File
        </button>
      </div>

      {/* Upload area */}
      <div className="card border-dashed border-2 border-gray-200 bg-gray-50 p-10 text-center mb-6 hover:border-brand-300 hover:bg-brand-50 transition-colors cursor-pointer">
        <FolderOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-500">Drag & drop files here or click to upload</p>
        <p className="text-xs text-gray-400 mt-1">Attach to any client automatically</p>
      </div>

      {/* Files by client */}
      {Object.keys(grouped).length > 0 ? (
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
                              <p className="font-medium text-gray-900">{file.name}</p>
                              {file.file_size && <p className="text-xs text-gray-400">{formatSize(file.file_size)}</p>}
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
                              <a href={file.drive_url} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">
                                <ExternalLink className="w-3 h-3" /> Drive
                              </a>
                            )}
                            {file.storage_path && (
                              <button className="btn-secondary btn-sm">Download</button>
                            )}
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
    </div>
  )
}
