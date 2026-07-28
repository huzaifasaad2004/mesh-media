'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, Link2, RefreshCw, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

const platforms = [
  { value: 'meta_ads', label: 'Meta Ads', colour: '#1877F2' },
  { value: 'instagram', label: 'Instagram', colour: '#C13584' },
  { value: 'google_ads', label: 'Google Ads', colour: '#4285F4' },
]
const day = (d: Date) => d.toISOString().slice(0, 10)
const number = (n = 0) => n.toLocaleString(undefined, { maximumFractionDigits: 1 })
const money = (n = 0) => `AED ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`

export default function CampaignReportingPage() {
  const toast = useToast()
  const [clients, setClients] = useState<any[]>([]), [projects, setProjects] = useState<any[]>([]), [connections, setConnections] = useState<any[]>([])
  const [client, setClient] = useState(''), [project, setProject] = useState(''), [range, setRange] = useState('30'), [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false), [canManage, setCanManage] = useState(false)
  const [form, setForm] = useState({ provider: 'meta_ads', account: '', name: '', manager: '' })

  useEffect(() => { Promise.all([fetch('/api/clients').then(r => r.json()), fetch('/api/projects').then(r => r.json()), fetch('/api/profiles/me').then(r => r.json())]).then(([c,p,me]) => { setClients(Array.isArray(c)?c:[]); setProjects(Array.isArray(p)?p:[]); setCanManage(['owner','admin','manager'].includes(me.role)); if (c?.[0]) setClient(c[0].id) }) }, [])
  const loadConnections = useCallback(() => { if (canManage) fetch('/api/campaign-reporting/connections').then(r=>r.json()).then(d=>setConnections(Array.isArray(d)?d:[])) }, [canManage])
  useEffect(() => { loadConnections() }, [loadConnections])
  const load = useCallback(async () => {
    if (!client) return; setLoading(true); const end = new Date(), start = new Date(); start.setDate(end.getDate()-Number(range)+1)
    const q = new URLSearchParams({ client, start: day(start), end: day(end) }); if(project) q.set('project', project)
    const r = await fetch(`/api/campaign-reporting/dashboard?${q}`), body = await r.json(); setLoading(false); r.ok ? setData(body) : toast.error(body.error || 'Could not load reports')
  }, [client, project, range, toast])
  useEffect(() => { load() }, [load])
  const clientProjects = useMemo(() => projects.filter(p=>p.client_id===client), [projects,client])
  const totals = data?.totals ?? {}, ctr = totals.impressions ? totals.clicks/totals.impressions*100 : 0, roas = totals.spend ? totals.revenue/totals.spend : 0

  async function connect(e: React.FormEvent) {
    e.preventDefault(); const r = await fetch('/api/campaign-reporting/connections',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:form.provider,client_id:client,project_id:project||null,external_account_id:form.account,account_name:form.name,login_customer_id:form.manager})}); const body=await r.json()
    if(!r.ok) return toast.error(body.error||'Could not create connection'); location.href=`/api/campaign-reporting/oauth/${form.provider}/start?connection=${body.id}`
  }
  async function sync(id:string){const r=await fetch('/api/campaign-reporting/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({connectionId:id})}),b=await r.json();r.ok?toast.success(`Imported ${b.imported} daily records`):toast.error(b.error);load();loadConnections()}
  async function remove(id:string){if(!confirm('Remove this connection? Historical reporting data will remain.'))return;await fetch(`/api/campaign-reporting/connections/${id}`,{method:'DELETE'});loadConnections()}

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-semibold text-ink flex items-center gap-2"><BarChart3 className="w-6 h-6 text-brand-600"/>Campaign Reporting</h1><p className="text-sm text-taupe-500 mt-1">Automated performance, separated by client, project, and platform.</p></div>
    <div className="card p-4 grid gap-3 md:grid-cols-3">
      <select className="input" value={client} onChange={e=>{setClient(e.target.value);setProject('')}}><option value="">Select client</option>{clients.map(c=><option key={c.id} value={c.id}>{c.company_name}</option>)}</select>
      <select className="input" value={project} onChange={e=>setProject(e.target.value)}><option value="">All client projects</option>{clientProjects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <select className="input" value={range} onChange={e=>setRange(e.target.value)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select>
    </div>
    {loading?<div className="card p-10 text-center text-taupe-500">Loading performance…</div>:<>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[['Spend',money(totals.spend)],['Impressions',number(totals.impressions)],['Clicks',number(totals.clicks)],['CTR',`${ctr.toFixed(2)}%`],['Reach',number(totals.reach)],['Leads',number(totals.leads)],['Conversions',number(totals.conversions)],['ROAS',`${roas.toFixed(2)}×`]].map(([a,b])=><div className="card p-4" key={a}><p className="text-xs uppercase tracking-wide text-taupe-500">{a}</p><p className="text-xl font-semibold mt-1">{b}</p></div>)}</div>
      <div className="grid md:grid-cols-3 gap-4">{platforms.map(p=>{const x=data?.byProvider?.find((v:any)=>v.provider===p.value)??{};return <div className="card p-5" key={p.value} style={{borderTop:`3px solid ${p.colour}`}}><h2 className="font-semibold">{p.label}</h2><div className="grid grid-cols-2 gap-3 mt-4 text-sm"><span className="text-taupe-500">Spend</span><b>{money(x.spend)}</b><span className="text-taupe-500">Impressions</span><b>{number(x.impressions)}</b><span className="text-taupe-500">Clicks</span><b>{number(x.clicks)}</b><span className="text-taupe-500">Conversions</span><b>{number(x.conversions)}</b></div></div>})}</div>
      <div className="card overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-sand-300 text-left text-taupe-500"><th className="p-4">Campaign</th><th>Platform</th><th>Spend</th><th>Impressions</th><th>Clicks</th><th>Leads</th><th>Conversions</th></tr></thead><tbody>{(data?.campaigns??[]).map((c:any)=><tr className="border-b border-sand-200" key={`${c.provider}-${c.id}`}><td className="p-4 font-medium">{c.name}</td><td>{platforms.find(p=>p.value===c.provider)?.label}</td><td>{money(c.spend)}</td><td>{number(c.impressions)}</td><td>{number(c.clicks)}</td><td>{number(c.leads)}</td><td>{number(c.conversions)}</td></tr>)}</tbody></table>{!data?.campaigns?.length&&<p className="p-8 text-center text-taupe-500">No campaign data in this period yet.</p>}</div>
    </>}
    {canManage&&<div className="card p-5"><h2 className="text-lg font-semibold">Platform connections</h2><p className="text-sm text-taupe-500 mt-1">Each connection belongs to the selected client and optional project.</p>
      <form onSubmit={connect} className="grid md:grid-cols-5 gap-3 mt-4"><select className="input" value={form.provider} onChange={e=>setForm({...form,provider:e.target.value})}>{platforms.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}</select><input required className="input" placeholder="Account ID" value={form.account} onChange={e=>setForm({...form,account:e.target.value})}/><input className="input" placeholder="Account name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>{form.provider==='google_ads'&&<input className="input" placeholder="Manager account ID" value={form.manager} onChange={e=>setForm({...form,manager:e.target.value})}/>}<button disabled={!client} className="btn-primary flex justify-center items-center gap-2"><Link2 className="w-4 h-4"/>Connect</button></form>
      <div className="space-y-2 mt-5">{connections.filter(c=>c.client_id===client).map(c=><div className="flex flex-wrap gap-3 items-center border border-sand-300 rounded-lg p-3" key={c.id}><b>{platforms.find(p=>p.value===c.provider)?.label}</b><span className="text-sm">{c.account_name||c.external_account_id}</span><span className={`text-xs px-2 py-1 rounded-full ${c.status==='active'?'bg-green-100 text-green-700':'bg-amber-100 text-amber-700'}`}>{c.status}</span><span className="text-xs text-taupe-500 flex-1">{c.last_synced_at?`Synced ${new Date(c.last_synced_at).toLocaleString()}`:'Not synced yet'}</span><button onClick={()=>sync(c.id)} title="Sync"><RefreshCw className="w-4 h-4"/></button><button onClick={()=>remove(c.id)} title="Remove"><Trash2 className="w-4 h-4 text-red-600"/></button></div>)}</div>
    </div>}
  </div>
}
