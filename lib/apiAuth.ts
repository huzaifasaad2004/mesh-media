import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { isAdmin, isStaff, type Role } from '@/lib/roles'
import { hasPermission } from '@/lib/permissions'

// Role sets mirror the database RLS policies in phase5_rbac.sql — keep in sync.
export const OPS_WRITE: Role[] = ['owner', 'admin', 'manager', 'member'] // can_write_ops()
export const MANAGERS: Role[] = ['owner', 'admin', 'manager']

export type Authed = { user: User; role: Role; db: ReturnType<typeof createClient> }
export type Denied = { res: NextResponse }

const deny = (status: number, error: string): Denied => ({
  res: NextResponse.json({ error }, { status }),
})

/** Drop columns callers must never set directly (mass-assignment guard). */
export function stripProtected<T extends Record<string, unknown>>(body: T) {
  const { id, created_at, updated_at, created_by, ...rest } = body ?? {}
  return rest
}

/** Service-role client — BYPASSES RLS. Only use after an explicit role check. */
export const serviceRole = () =>
  createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

/** The authenticated caller, their role, and an RLS-scoped client. */
export async function requireUser(): Promise<Authed | Denied> {
  const db = createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return deny(401, 'Not authenticated')
  const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single()
  return { user, role: (profile?.role ?? 'client') as Role, db }
}

/** Caller must be a staff member (any non-client role). */
export async function requireStaff(): Promise<Authed | Denied> {
  const auth = await requireUser()
  if ('res' in auth) return auth
  if (!isStaff(auth.role)) return deny(403, 'Not allowed')
  return auth
}

/** Caller must hold one of the given roles, or the fallback permission key
 *  via a per-user override (admins grant those on the Team page). */
export async function requireRoles(roles: Role[], overridePermission?: string): Promise<Authed | Denied> {
  const auth = await requireUser()
  if ('res' in auth) return auth
  if (roles.includes(auth.role)) return auth
  if (overridePermission && isStaff(auth.role)) {
    const ok = await hasPermission(serviceRole(), auth.user.id, auth.role, overridePermission)
    if (ok) return auth
  }
  return deny(403, 'Not allowed')
}

/** Owner/admin always pass; everyone else needs the effective permission —
 *  no hardcoded role bypass, so revoking a permission in the permissions
 *  matrix (`/settings/permissions`) actually takes effect for every role. */
async function requirePermission(permission: string): Promise<Authed | Denied> {
  const auth = await requireUser()
  if ('res' in auth) return auth
  if (isAdmin(auth.role)) return auth
  if (isStaff(auth.role) && await hasPermission(serviceRole(), auth.user.id, auth.role, permission)) {
    return auth
  }
  return deny(403, 'Not allowed')
}

/** Caller may view finance data (invoices, quotations, expenses). */
export const requireFinanceRead = () => requirePermission('finance.read')
/** Caller may create/edit/delete finance records. */
export const requireFinanceWrite = () => requirePermission('finance.write')
/** Caller may view salaries/payslips. */
export const requirePayrollRead = () => requirePermission('payroll.read')
/** Caller may manage salaries and record payments. */
export const requirePayrollWrite = () => requirePermission('payroll.write')
/** Caller may create/assign/delete tasks (not just update ones already assigned to them). */
export const requireTasksManage = () => requirePermission('tasks.manage')
/** Caller may create/edit projects. */
export const requireProjectsWrite = () => requirePermission('projects.write')
/** Caller may delete projects. */
export const requireProjectsDelete = () => requirePermission('projects.delete')
/** Caller may email invoices/quotations to clients. */
export const requireInvoicesSend = () => requirePermission('invoices.send')
/** Caller may upload documents and place e-signature fields. */
export const requireDocumentsWrite = () => requirePermission('documents.write')
/** Caller may review submitted content and forward/return it. */
export const requireContentApprove = () => requirePermission('content.approve')
/** Caller may view contractors and their payment history. */
export const requireContractorsRead = () => requirePermission('contractors.read')
/** Caller may add contractors and record payments to them. */
export const requireContractorsWrite = () => requirePermission('contractors.write')
