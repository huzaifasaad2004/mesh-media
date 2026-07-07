import { NextRequest, NextResponse } from 'next/server'
import { requireFinanceWrite } from '@/lib/apiAuth'
import type { User } from '@supabase/supabase-js'

/** Vercel Cron calls with `Authorization: Bearer $CRON_SECRET` (set the same
 *  value in both the Vercel env vars and here). A signed-in finance.write
 *  user can also trigger the job manually (e.g. a "Run now" button). */
export async function requireCronOrFinanceWrite(req: NextRequest): Promise<{ user: User | null } | { res: NextResponse }> {
  const secret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (secret && authHeader === `Bearer ${secret}`) return { user: null }

  const auth = await requireFinanceWrite()
  if ('res' in auth) return auth
  return { user: auth.user }
}
