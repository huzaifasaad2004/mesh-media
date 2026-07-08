'use client'

import { useRef, useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { getInitials } from '@/lib/utils'

const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve((reader.result as string).split(',')[1])
  reader.onerror = reject
  reader.readAsDataURL(file)
})

export default function ProfileEditor({
  fullName, email, avatarUrl, onSaved,
}: {
  fullName: string | null
  email: string | null
  avatarUrl: string | null
  onSaved: (patch: { full_name?: string; avatar_url?: string }) => void
}) {
  const [name, setName] = useState(fullName ?? '')
  const [avatar, setAvatar] = useState(avatarUrl)
  const [savingName, setSavingName] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  const saveName = async () => {
    if (!name.trim()) { toast.error('Name cannot be empty'); return }
    setSavingName(true)
    const res = await fetch('/api/profiles/me', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ full_name: name.trim() }),
    })
    const d = await res.json()
    setSavingName(false)
    if (res.ok) { toast.success('Name updated'); onSaved({ full_name: d.full_name }) }
    else toast.error(d.error ?? 'Failed to update name')
  }

  const uploadAvatar = async (file: File) => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast.error('Please choose a PNG, JPEG, or WebP image'); return
    }
    if (file.size > 3 * 1024 * 1024) { toast.error('Image is too large (max 3MB)'); return }
    setUploadingAvatar(true)
    const avatar_base64 = await fileToBase64(file)
    const res = await fetch('/api/profiles/me', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar_base64, avatar_mime: file.type }),
    })
    const d = await res.json()
    setUploadingAvatar(false)
    if (res.ok) { toast.success('Photo updated'); setAvatar(d.avatar_url); onSaved({ avatar_url: d.avatar_url }) }
    else toast.error(d.error ?? 'Failed to upload photo')
  }

  return (
    <div className="card p-6 space-y-6">
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-brand-600 text-paper-100 flex items-center justify-center text-lg font-semibold overflow-hidden flex-shrink-0">
            {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : getInitials(name || email)}
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white border border-sand-300 flex items-center justify-center text-taupe-600 hover:text-brand-600 shadow-sm"
            title="Change photo"
          >
            {uploadingAvatar ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = '' }}
          />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Profile photo</p>
          <p className="text-xs text-taupe-500 mt-0.5">PNG, JPEG, or WebP · up to 3MB</p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-taupe-700 mb-1">Full name</label>
        <div className="flex gap-2">
          <input
            className="flex-1 border border-sand-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button onClick={saveName} disabled={savingName || name.trim() === fullName} className="btn-primary btn-sm">
            {savingName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-taupe-700 mb-1">Email</label>
        <p className="text-sm text-taupe-500">{email} <span className="text-xs">(contact an admin to change)</span></p>
      </div>
    </div>
  )
}
