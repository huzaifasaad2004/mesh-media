import { Resend } from 'resend'
import type { SupabaseClient } from '@supabase/supabase-js'
import { COMPANY } from '@/lib/company'

/** Keep in sync with the CHECK constraint in supabase/phase28_notification_preferences.sql. */
export type NotifyCategory = 'task_assignment' | 'approval_request' | 'content_review' | 'critical_alert'

/**
 * Creates the existing in-app notification rows, then — unless the
 * recipient has opted out for this category — also emails them via
 * Resend. `db` must be a service-role client (recipients other than
 * the caller aren't readable under RLS).
 */
export async function notifyUsers(db: SupabaseClient, opts: {
  userIds: (string | null | undefined)[]
  title: string
  body?: string | null
  href?: string | null
  category: NotifyCategory
}) {
  const ids = Array.from(new Set(opts.userIds.filter((id): id is string => !!id)))
  if (ids.length === 0) return

  await db.from('notifications').insert(ids.map(id => ({
    user_id: id, title: opts.title, body: opts.body ?? null, href: opts.href ?? null,
  })))

  if (!process.env.RESEND_API_KEY) return

  const [{ data: profiles }, { data: prefs }] = await Promise.all([
    db.from('profiles').select('id, email').in('id', ids),
    db.from('notification_preferences').select('user_id, email_enabled').in('user_id', ids).eq('category', opts.category),
  ])
  const optedOut = new Set((prefs ?? []).filter((p: any) => !p.email_enabled).map((p: any) => p.user_id))
  const recipients = (profiles ?? []).filter((p: any) => p.email && !optedOut.has(p.id))
  if (recipients.length === 0) return

  const resend = new Resend(process.env.RESEND_API_KEY)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.m3m.ae'
  await Promise.all(recipients.map((r: any) => resend.emails.send({
    from: `MeshMedia <${process.env.RESEND_FROM_EMAIL ?? 'hello@m3m.ae'}>`,
    to: r.email,
    subject: opts.title,
    html: `<!DOCTYPE html><html><body style="font-family:Inter,Arial,sans-serif;background:#f5f5f5;margin:0;">
<div style="max-width:520px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
  <div style="background:#6E1318;padding:24px 32px;"><h1 style="color:#fff;margin:0;font-size:18px;">${COMPANY.name}</h1></div>
  <div style="padding:24px 32px;font-size:14px;line-height:1.6;color:#1a1a1a;">
    <p style="font-weight:600;margin:0 0 8px;">${opts.title}</p>
    ${opts.body ? `<p style="color:#555;margin:0 0 16px;">${opts.body}</p>` : ''}
    ${opts.href ? `<p><a href="${baseUrl}${opts.href}" style="display:inline-block;background:#6E1318;color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:600;">Open in Agency OS →</a></p>` : ''}
  </div>
  <div style="background:#f9f9f9;border-top:1px solid #eee;padding:14px 32px;font-size:11px;color:#999;text-align:center;">${COMPANY.name} · manage email alerts in the bell menu → Notification settings</div>
</div>
</body></html>`,
  }).catch(() => {})))
}
