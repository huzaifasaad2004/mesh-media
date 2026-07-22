'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { ArrowLeft, FileText, Hash, Lock, MessageCircle, Mic, Paperclip, Plus, Reply, Search, Send, Users, X } from 'lucide-react'

type Person = { id: string; full_name: string | null; email: string | null; avatar_url: string | null; role: string }
type Member = { user_id: string; role: string; last_read_at: string; profile: Person }
type Channel = { id: string; name: string | null; description: string | null; kind: 'channel' | 'group' | 'direct'; is_private: boolean; members: Member[]; unread_count: number; last_message?: { body: string | null; message_type: string; created_at: string } }
type Message = { id: string; channel_id: string; sender_id: string; body: string | null; message_type: string; attachment_url?: string | null; attachment_name?: string | null; attachment_size?: number | null; voice_duration_seconds?: number | null; created_at: string; sender?: Person; reply?: { id: string; body: string | null; sender?: { full_name: string | null } }; reactions?: { emoji: string; user_id: string }[] }

const inputClass = 'w-full border border-gray-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '🙏']

function initials(person?: Person) {
  const value = person?.full_name || person?.email || '?'
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

function Avatar({ person, size = 'md' }: { person?: Person; size?: 'sm' | 'md' }) {
  return <div className={`${size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-9 h-9 text-xs'} rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-semibold flex-shrink-0 overflow-hidden`}>
    {person?.avatar_url ? <img src={person.avatar_url} alt="" className="w-full h-full object-cover" /> : initials(person)}
  </div>
}

function CreateConversation({ people, onCreated, onClose }: { people: Person[]; onCreated: (id: string) => void; onClose: () => void }) {
  const [kind, setKind] = useState<'channel' | 'group' | 'direct'>('channel')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPrivate, setPrivate] = useState(false)
  const [members, setMembers] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggle = (id: string) => setMembers((current) => current.includes(id) ? current.filter((x) => x !== id) : kind === 'direct' ? [id] : [...current, id])
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSaving(true)
    const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, name, description, is_private: isPrivate, member_ids: members }) })
    const data = await res.json(); setSaving(false)
    if (!res.ok) return setError(data.error ?? 'Could not create conversation')
    onCreated(data.id); onClose()
  }

  return <form onSubmit={submit} className="space-y-4">
    <div className="grid grid-cols-3 gap-2">
      {([['channel', 'Channel'], ['group', 'Group chat'], ['direct', 'Direct']] as const).map(([value, label]) => <button type="button" key={value} onClick={() => { setKind(value); setMembers([]) }} className={`rounded-lg border px-2 py-2 text-xs font-medium ${kind === value ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600'}`}>{label}</button>)}
    </div>
    {kind !== 'direct' && <><div><label className="label">Name</label><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === 'channel' ? 'e.g. creative-team' : 'e.g. Launch planning'} required /></div>
      <div><label className="label">Description <span className="text-gray-400">(optional)</span></label><textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div></>}
    {kind === 'channel' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isPrivate} onChange={(e) => setPrivate(e.target.checked)} /> Private channel — only selected members can open it</label>}
    {(kind !== 'channel' || isPrivate) && <div><label className="label">{kind === 'direct' ? 'Choose a person' : 'Add members'}</label><div className="border border-gray-200 rounded-lg max-h-56 overflow-y-auto divide-y divide-gray-100">
      {people.map((person) => <label key={person.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"><input type={kind === 'direct' ? 'radio' : 'checkbox'} checked={members.includes(person.id)} onChange={() => toggle(person.id)} /><Avatar person={person} size="sm" /><span className="text-sm flex-1 min-w-0 truncate">{person.full_name || person.email}</span><span className="text-[10px] uppercase text-gray-400">{person.role}</span></label>)}
    </div></div>}
    {error && <p className="text-sm text-red-600">{error}</p>}
    <button className="btn-primary w-full justify-center" disabled={saving}>{saving ? 'Creating…' : kind === 'direct' ? 'Start conversation' : 'Create'}</button>
  </form>
}

export default function ChatPage() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [me, setMe] = useState('')
  const [myProfile, setMyProfile] = useState<Person | undefined>()
  const [selectedId, setSelectedId] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [messageError, setMessageError] = useState('')
  const [draft, setDraft] = useState('')
  const [replying, setReplying] = useState<Message | null>(null)
  const [sending, setSending] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')
  const [mobileList, setMobileList] = useState(true)
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordStartRef = useRef(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const supabase = useMemo(() => createClient(), [])

  const loadChannels = useCallback(async (keepSelection = true) => {
    const res = await fetch('/api/chat'); const data = await res.json()
    if (!res.ok) { setLoading(false); return toast.error(data.error ?? 'Chat needs its database migration') }
    setChannels(data.channels)
    setMyProfile(data.people.find((person: Person) => person.id === data.me))
    setPeople(data.people.filter((person: Person) => person.id !== data.me))
    setMe(data.me)
    if (!keepSelection) {
      const requested = new URLSearchParams(window.location.search).get('channel')
      setSelectedId(data.channels.some((channel: Channel) => channel.id === requested) ? requested! : data.channels[0]?.id ?? '')
    }
    setLoading(false)
  }, [toast])

  const loadMessages = useCallback(async (channelId: string, showLoader = true) => {
    if (!channelId) return
    if (showLoader) setLoadingMessages(true)
    setMessageError('')
    const res = await fetch(`/api/chat/channels/${channelId}/messages`); const data = await res.json()
    if (!res.ok) {
      setMessageError(data.error ?? 'Messages could not be loaded')
      setLoadingMessages(false)
      return
    }
    setMessages(Array.isArray(data) ? data : [])
    setLoadingMessages(false)
    if (res.ok) fetch(`/api/chat/channels/${channelId}/read`, { method: 'POST' }).then(() => setChannels((all) => all.map((c) => c.id === channelId ? { ...c, unread_count: 0 } : c)))
  }, [])

  useEffect(() => { loadChannels(false) }, [loadChannels])
  useEffect(() => { if (selectedId) loadMessages(selectedId) }, [selectedId, loadMessages])
  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'end' }) }, [messages])
  useEffect(() => {
    const subscription = supabase.channel('mesh-chat-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload: any) => {
        const incoming = payload.new
        setChannels((all) => all.map((channel) => channel.id === incoming.channel_id ? {
          ...channel,
          last_message: incoming,
          unread_count: incoming.channel_id !== selectedId && incoming.sender_id !== me ? channel.unread_count + 1 : channel.unread_count,
        } : channel))
        if (incoming.channel_id === selectedId && incoming.sender_id !== me) loadMessages(selectedId, false)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_reactions' }, () => selectedId && loadMessages(selectedId))
      .subscribe()
    return () => { supabase.removeChannel(subscription) }
  }, [supabase, selectedId, me, loadMessages])

  useEffect(() => {
    if (!recording) return
    const timer = window.setInterval(() => setRecordSeconds(Math.floor((Date.now() - recordStartRef.current) / 1000)), 500)
    return () => window.clearInterval(timer)
  }, [recording])

  const selected = channels.find((channel) => channel.id === selectedId)
  const titleFor = (channel: Channel) => {
    if (channel.kind === 'direct') return channel.members?.find((member) => member.user_id !== me)?.profile?.full_name || channel.members?.find((member) => member.user_id !== me)?.profile?.email || 'Direct message'
    return channel.name || 'Group chat'
  }
  const filtered = channels.filter((channel) => titleFor(channel).toLowerCase().includes(search.toLowerCase()))

  const sendText = async () => {
    if (!draft.trim() || !selectedId || sending) return
    const text = draft.trim()
    const reply = replying
    const optimisticId = `pending-${crypto.randomUUID()}`
    const optimistic: Message = {
      id: optimisticId, channel_id: selectedId, sender_id: me, body: text,
      message_type: 'text', created_at: new Date().toISOString(), sender: myProfile,
      reply: reply ? { id: reply.id, body: reply.body, sender: { full_name: reply.sender?.full_name ?? 'Team member' } } : undefined,
      reactions: [],
    }
    setMessages((current) => [...current, optimistic])
    setChannels((all) => all.map((channel) => channel.id === selectedId ? { ...channel, last_message: optimistic } : channel))
    setDraft('')
    setReplying(null)
    setSending(true)
    const res = await fetch(`/api/chat/channels/${selectedId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: text, reply_to_id: reply?.id }) })
    const data = await res.json(); setSending(false)
    if (!res.ok) {
      setMessages((current) => current.filter((message) => message.id !== optimisticId))
      setDraft(text)
      return toast.error(data.error ?? 'Message failed')
    }
    const confirmed = { ...data, reply: optimistic.reply }
    setMessages((current) => current.map((message) => message.id === optimisticId ? confirmed : message))
    void fetch(`/api/chat/messages/${data.id}/notify`, { method: 'POST' }).catch(() => {})
  }

  const upload = async (file: File, duration = 0) => {
    if (!selectedId) return
    const messageType = file.type.startsWith('audio/') ? 'voice' : file.type.startsWith('image/') ? 'image' : 'file'
    const pendingId = `upload-${crypto.randomUUID()}`
    const previewUrl = URL.createObjectURL(file)
    const pending: Message = {
      id: pendingId, channel_id: selectedId, sender_id: me, body: null,
      message_type: messageType, attachment_url: previewUrl, attachment_name: file.name,
      attachment_size: file.size, voice_duration_seconds: duration || null,
      created_at: new Date().toISOString(), sender: myProfile, reactions: [],
    }
    setMessages((current) => [...current, pending])
    setChannels((all) => all.map((channel) => channel.id === selectedId ? { ...channel, last_message: pending } : channel))
    setSending(true)
    try {
      const form = new FormData(); form.append('file', file); form.append('duration', String(duration)); if (replying) form.append('reply_to_id', replying.id)
      const res = await fetch(`/api/chat/channels/${selectedId}/upload`, { method: 'POST', body: form })
      const data = await res.json().catch(() => ({ error: 'The upload could not be processed' }))
      if (!res.ok) {
        setMessages((current) => current.filter((message) => message.id !== pendingId))
        return toast.error(data.error ?? 'Upload failed')
      }
      setReplying(null)
      setMessages((current) => current.map((message) => message.id === pendingId ? data : message))
      setChannels((all) => all.map((channel) => channel.id === selectedId ? { ...channel, last_message: data } : channel))
      void loadMessages(selectedId, false)
      void fetch(`/api/chat/messages/${data.id}/notify`, { method: 'POST' }).catch(() => {})
    } catch {
      setMessages((current) => current.filter((message) => message.id !== pendingId))
      toast.error('Voice note upload failed. Please check your connection and try again.')
    } finally {
      URL.revokeObjectURL(previewUrl)
      setSending(false)
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const preferred = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((type) => MediaRecorder.isTypeSupported(type))
      const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined)
      chunksRef.current = []; recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data) }
      recorder.onstop = () => { stream.getTracks().forEach((track) => track.stop()) }
      recorderRef.current = recorder; recordStartRef.current = Date.now(); setRecordSeconds(0); setRecording(true); recorder.start()
    } catch { toast.error('Microphone permission is needed to record a voice note') }
  }
  const stopRecording = (send: boolean) => {
    const recorder = recorderRef.current; if (!recorder) return
    const duration = Math.max(1, Math.round((Date.now() - recordStartRef.current) / 1000))
    recorder.onstop = () => {
      recorder.stream.getTracks().forEach((track) => track.stop())
      if (send) { const type = recorder.mimeType.split(';')[0] || 'audio/webm'; const extension = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'; upload(new File(chunksRef.current, `voice-note.${extension}`, { type }), duration) }
    }
    recorder.stop(); setRecording(false); recorderRef.current = null
  }

  const react = async (messageId: string, emoji: string) => {
    await fetch(`/api/chat/messages/${messageId}/reactions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emoji }) }); loadMessages(selectedId)
  }

  const reactionGroups = (message: Message) => Object.entries((message.reactions ?? []).reduce<Record<string, string[]>>((acc, reaction) => { (acc[reaction.emoji] ??= []).push(reaction.user_id); return acc }, {}))

  if (loading) return <div className="h-[70vh] flex items-center justify-center text-sm text-gray-500">Opening Mesh Chat…</div>

  return <div className="-mx-4 sm:-mx-6 -my-6 h-[calc(100dvh-3.5rem)] lg:h-screen flex bg-white overflow-hidden">
    <aside className={`${mobileList ? 'flex' : 'hidden'} md:flex w-full md:w-80 lg:w-96 border-r border-gray-200 flex-col bg-paper-50`}>
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3"><div><h1 className="text-xl font-semibold text-gray-900">Mesh Chat</h1><p className="text-xs text-gray-500">Your team, in one place</p></div><button onClick={() => setShowCreate(true)} className="w-9 h-9 rounded-lg bg-brand-600 text-white flex items-center justify-center" title="New conversation"><Plus className="w-4 h-4" /></button></div>
        <div className="relative"><Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} className={`${inputClass} pl-9`} placeholder="Search conversations" /></div>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {filtered.map((channel) => { const active = channel.id === selectedId; const other = channel.members?.find((m) => m.user_id !== me)?.profile
          return <button key={channel.id} onClick={() => { setSelectedId(channel.id); setMobileList(false) }} className={`w-full text-left px-4 py-3 flex items-center gap-3 border-l-2 ${active ? 'bg-white border-brand-600' : 'border-transparent hover:bg-white/70'}`}>
            {channel.kind === 'direct' ? <Avatar person={other} /> : <div className="w-9 h-9 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center flex-shrink-0">{channel.kind === 'channel' ? <Hash className="w-4 h-4" /> : <Users className="w-4 h-4" />}</div>}
            <div className="min-w-0 flex-1"><div className="flex items-center gap-1"><p className="text-sm font-medium text-gray-900 truncate">{titleFor(channel)}</p>{channel.is_private && channel.kind === 'channel' && <Lock className="w-3 h-3 text-gray-400" />}</div><p className="text-xs text-gray-500 truncate">{channel.last_message?.message_type === 'voice' ? '🎙 Voice note' : channel.last_message?.message_type === 'image' ? '📷 Image' : channel.last_message?.body || channel.description || 'No messages yet'}</p></div>
            {!!channel.unread_count && <span className="min-w-5 h-5 px-1 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center">{channel.unread_count > 99 ? '99+' : channel.unread_count}</span>}
          </button> })}
        {!filtered.length && <div className="text-center px-6 py-16"><MessageCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" /><p className="text-sm text-gray-500">No conversations found</p></div>}
      </div>
    </aside>

    <section className={`${mobileList ? 'hidden' : 'flex'} md:flex flex-1 min-w-0 flex-col`}>
      {!selected ? <div className="flex-1 flex flex-col items-center justify-center text-center p-8"><MessageCircle className="w-12 h-12 text-brand-200 mb-3" /><h2 className="font-semibold text-gray-900">Start a conversation</h2><p className="text-sm text-gray-500 mt-1">Choose a channel or create a new chat.</p></div> : <>
        <header className="h-16 px-3 sm:px-5 border-b border-gray-200 flex items-center gap-3 flex-shrink-0"><button className="md:hidden p-1.5" onClick={() => setMobileList(true)}><ArrowLeft className="w-5 h-5" /></button><div className="w-9 h-9 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center">{selected.kind === 'direct' ? <MessageCircle className="w-4 h-4" /> : selected.kind === 'channel' ? <Hash className="w-4 h-4" /> : <Users className="w-4 h-4" />}</div><div className="min-w-0"><h2 className="font-semibold text-gray-900 truncate">{titleFor(selected)}</h2><p className="text-xs text-gray-500 truncate">{selected.description || `${selected.members?.length || (selected.is_private ? 0 : people.length + 1)} member${selected.members?.length === 1 ? '' : 's'}`}</p></div></header>
        <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-1 bg-paper-0">
          {loadingMessages ? <p className="text-center text-sm text-gray-400 py-12">Loading messages…</p> : messageError ? <div className="mx-auto mt-12 max-w-sm rounded-xl border border-red-200 bg-red-50 p-4 text-center"><p className="text-sm font-medium text-red-700">Messages didn’t load</p><p className="mt-1 text-xs text-red-600">{messageError}</p><button onClick={() => loadMessages(selectedId)} className="btn-secondary btn-sm mt-3">Try again</button></div> : !messages.length ? <div className="text-center py-20"><div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-3"><MessageCircle className="w-6 h-6" /></div><h3 className="font-medium text-gray-900">This is the beginning of {titleFor(selected)}</h3><p className="text-sm text-gray-500 mt-1">Send the first message.</p></div> : messages.map((message, index) => {
            const mine = message.sender_id === me; const previous = messages[index - 1]; const grouped = previous?.sender_id === message.sender_id && +new Date(message.created_at) - +new Date(previous.created_at) < 5 * 60_000
            return <div key={message.id} className={`group flex gap-2.5 ${grouped ? 'pt-0.5' : 'pt-4'} ${mine ? 'flex-row-reverse' : ''}`}>
              <div className="w-8 flex-shrink-0">{!grouped && <Avatar person={message.sender} size="sm" />}</div>
              <div className={`max-w-[82%] sm:max-w-[70%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                {!grouped && <div className={`flex items-baseline gap-2 mb-1 ${mine ? 'flex-row-reverse' : ''}`}><span className="text-xs font-medium text-gray-700">{mine ? 'You' : message.sender?.full_name || message.sender?.email}</span><span className="text-[10px] text-gray-400">{new Date(message.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span></div>}
                <div className="relative">
                  <div className={`rounded-2xl px-3.5 py-2 text-sm shadow-sm ${mine ? 'bg-brand-600 text-white rounded-tr-sm' : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm'}`}>
                    {message.reply && <div className={`mb-2 border-l-2 pl-2 text-xs ${mine ? 'border-white/50 text-white/75' : 'border-brand-300 text-gray-500'}`}><span className="font-medium">{message.reply.sender?.full_name}</span><p className="truncate max-w-xs">{message.reply.body || 'Attachment'}</p></div>}
                    {message.message_type === 'image' && message.attachment_url && <a href={message.attachment_url} target="_blank" rel="noreferrer"><img src={message.attachment_url} alt={message.attachment_name || 'Shared image'} className="rounded-lg max-h-72 max-w-full mb-1" /></a>}
                    {message.message_type === 'voice' && <div className="min-w-[220px]">{message.attachment_url ? <audio src={message.attachment_url} controls preload="metadata" className="w-full h-9" /> : <button onClick={() => loadMessages(selectedId, false)} className={`text-xs underline ${mine ? 'text-white' : 'text-brand-700'}`}>Load voice note</button>}<p className={`text-[10px] mt-1 ${mine ? 'text-white/70' : 'text-gray-400'}`}>Voice note{message.voice_duration_seconds ? ` · ${Math.floor(message.voice_duration_seconds / 60)}:${String(message.voice_duration_seconds % 60).padStart(2, '0')}` : ''}</p></div>}
                    {message.message_type === 'file' && message.attachment_url && <a href={message.attachment_url} target="_blank" rel="noreferrer" className={`flex items-center gap-2 min-w-[200px] ${mine ? 'text-white' : 'text-brand-700'}`}><FileText className="w-5 h-5" /><span className="truncate underline">{message.attachment_name || 'Download file'}</span></a>}
                    {message.body && <p className="whitespace-pre-wrap break-words">{message.body}</p>}
                  </div>
                  <div className={`absolute top-0 ${mine ? 'right-full mr-1' : 'left-full ml-1'} hidden group-hover:flex bg-white border border-gray-200 rounded-lg shadow-sm p-0.5 z-10`}><button onClick={() => setReplying(message)} className="p-1.5 text-gray-500 hover:text-brand-600" title="Reply"><Reply className="w-3.5 h-3.5" /></button>{QUICK_REACTIONS.slice(0, 3).map((emoji) => <button key={emoji} onClick={() => react(message.id, emoji)} className="p-1 text-xs hover:bg-gray-100 rounded">{emoji}</button>)}</div>
                </div>
                {!!reactionGroups(message).length && <div className="flex flex-wrap gap-1 mt-1">{reactionGroups(message).map(([emoji, users]) => <button key={emoji} onClick={() => react(message.id, emoji)} className={`rounded-full border px-1.5 py-0.5 text-[11px] ${users.includes(me) ? 'border-brand-300 bg-brand-50' : 'border-gray-200 bg-white'}`}>{emoji} {users.length}</button>)}</div>}
              </div>
            </div> })}
          <div ref={bottomRef} />
        </div>
        <footer className="border-t border-gray-200 bg-white p-2.5 sm:p-4 pb-[max(0.625rem,env(safe-area-inset-bottom))] flex-shrink-0">
          {replying && <div className="max-w-4xl mx-auto mb-2 flex items-center gap-2 bg-paper-50 border-l-2 border-brand-500 rounded-r-lg px-3 py-2"><Reply className="w-3.5 h-3.5 text-brand-600" /><div className="min-w-0 flex-1"><p className="text-[10px] font-medium text-brand-700">Replying to {replying.sender_id === me ? 'yourself' : replying.sender?.full_name}</p><p className="text-xs text-gray-500 truncate">{replying.body || replying.attachment_name || 'Attachment'}</p></div><button onClick={() => setReplying(null)}><X className="w-4 h-4 text-gray-400" /></button></div>}
          <div className="max-w-4xl mx-auto flex items-end gap-2">
            <input ref={fileRef} type="file" className="hidden" accept="image/*,application/pdf,audio/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) upload(file); e.target.value = '' }} />
            <button onClick={() => fileRef.current?.click()} disabled={sending || recording} className="w-11 h-11 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 flex-shrink-0" title="Attach a file" aria-label="Attach a file"><Paperclip className="w-5 h-5" /></button>
            {recording ? <div className="flex-1 h-11 border border-red-200 bg-red-50 rounded-xl flex items-center px-3 gap-3"><span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" /><span className="text-sm text-red-700 flex-1">Recording {Math.floor(recordSeconds / 60)}:{String(recordSeconds % 60).padStart(2, '0')}</span><button onClick={() => stopRecording(false)} className="text-xs text-gray-500">Cancel</button><button onClick={() => stopRecording(true)} className="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center" title="Send voice note"><Send className="w-3.5 h-3.5" /></button></div> : <textarea rows={1} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText() } }} className={`${inputClass} min-h-10 max-h-32 resize-none py-2.5`} placeholder={`Message ${titleFor(selected)}`} />}
            {!recording && (draft.trim() ? <button onClick={sendText} disabled={sending} className="w-11 h-11 rounded-xl bg-brand-600 text-white flex items-center justify-center flex-shrink-0 disabled:opacity-60" aria-label="Send message"><Send className="w-4 h-4" /></button> : <button onClick={startRecording} disabled={sending} className="w-11 h-11 rounded-xl text-gray-500 hover:bg-gray-100 flex items-center justify-center flex-shrink-0" title="Record voice note" aria-label="Record voice note"><Mic className="w-5 h-5" /></button>)}
          </div>
          <p className="hidden sm:block max-w-4xl mx-auto text-[10px] text-gray-400 mt-1.5 pl-12">Enter to send · Shift + Enter for a new line · attachments up to 20MB</p>
        </footer>
      </>}
    </section>

    <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New conversation" size="md"><CreateConversation people={people} onClose={() => setShowCreate(false)} onCreated={(id) => { loadChannels(true).then(() => { setSelectedId(id); setMobileList(false) }) }} /></Modal>
  </div>
}
