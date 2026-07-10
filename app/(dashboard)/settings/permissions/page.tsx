'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

type Permission = { key: string; description: string | null }

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner', admin: 'Admin', manager: 'Manager', member: 'Member', viewer: 'Viewer',
}

const MODULE_LABELS: Record<string, string> = {
  clients: 'Clients', tasks: 'Tasks', projects: 'Projects', finance: 'Finance',
  payroll: 'Payroll', invoices: 'Invoices', documents: 'Documents', content: 'Content',
  team: 'Team', settings: 'Settings',
}

export default function PermissionsMatrixPage() {
  const [roles, setRoles] = useState<string[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [grid, setGrid] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const toast = useToast()

  const groups = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    const mod = p.key.split('.')[0]
    ;(acc[mod] ??= []).push(p)
    return acc
  }, {})

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/role-permissions')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load')
      setRoles(data.roles ?? [])
      setPermissions(data.permissions ?? [])
      setGrid(new Set(data.grid ?? []))
      setError('')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const toggle = async (role: string, permission: string) => {
    const cellKey = `${role}:${permission}`
    const wasGranted = grid.has(cellKey)
    const nextGranted = !wasGranted

    // Optimistic update
    setGrid((g) => {
      const next = new Set(g)
      if (nextGranted) next.add(cellKey); else next.delete(cellKey)
      return next
    })
    setSaving(cellKey)

    const res = await fetch('/api/role-permissions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, permission, granted: nextGranted }),
    })
    setSaving(null)

    if (!res.ok) {
      // Revert on failure
      setGrid((g) => {
        const next = new Set(g)
        if (wasGranted) next.add(cellKey); else next.delete(cellKey)
        return next
      })
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? 'Failed to update permission')
    }
  }

  if (loading) return <div className="card h-60 animate-pulse bg-paper-100" />

  if (error) return (
    <div className="card px-6 py-16 text-center">
      <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
      <Link href="/settings" className="btn-secondary btn-sm mt-4 inline-flex">Back to settings</Link>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/settings" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="w-4 h-4" /></Link>
          <div>
            <h1>Permissions Matrix</h1>
            <p className="text-gray-500 text-sm mt-0.5">Role defaults — click a cell to grant or revoke. Owner/admin always have full access.</p>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 sticky left-0 bg-gray-50">Permission</th>
                {roles.map((role) => (
                  <th key={role} className="text-center px-5 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">
                    {ROLE_LABELS[role] ?? role}
                  </th>
                ))}
              </tr>
            </thead>
            {Object.entries(groups).map(([mod, rows]) => (
              <tbody key={mod} className="divide-y divide-gray-50">
                <tr>
                  <td colSpan={roles.length + 1} className="px-5 pt-4 pb-1.5 sticky left-0 bg-white">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{MODULE_LABELS[mod] ?? mod}</p>
                  </td>
                </tr>
                {rows.map((p) => (
                  <tr key={p.key} className="table-row">
                    <td className="px-5 py-3 sticky left-0 bg-white">
                      <p className="font-medium text-gray-900">{p.key}</p>
                      {p.description && <p className="text-xs text-gray-400 mt-0.5">{p.description}</p>}
                    </td>
                    {roles.map((role) => {
                      const cellKey = `${role}:${p.key}`
                      const granted = grid.has(cellKey)
                      const isOwnerOrAdmin = role === 'owner' || role === 'admin'
                      return (
                        <td key={role} className="px-5 py-3 text-center">
                          <button
                            disabled={isOwnerOrAdmin || saving === cellKey}
                            onClick={() => toggle(role, p.key)}
                            title={isOwnerOrAdmin ? `${ROLE_LABELS[role]} always has full access` : `${granted ? 'Revoke' : 'Grant'} ${p.key} for ${ROLE_LABELS[role]}`}
                            className={`w-7 h-7 rounded-md inline-flex items-center justify-center border transition-colors disabled:cursor-not-allowed ${
                              granted || isOwnerOrAdmin
                                ? 'bg-brand-600 border-brand-600 text-white'
                                : 'bg-white border-gray-200 text-transparent hover:border-brand-300'
                            } ${saving === cellKey ? 'opacity-50' : ''}`}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </div>
    </div>
  )
}
