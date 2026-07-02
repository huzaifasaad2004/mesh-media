import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = admin()
  const [{ data: project, error }, { data: tasks }, { data: invoices }, { data: files }, { data: milestones }] =
    await Promise.all([
      db.from('projects').select('*, client:clients(id, company_name, email)').eq('id', params.id).single(),
      db.from('tasks').select('*, assignee:profiles!tasks_assigned_to_fkey(full_name)').eq('project_id', params.id).order('created_at', { ascending: false }),
      db.from('invoices').select('id, invoice_number, total, status, issue_date').eq('project_id', params.id).order('issue_date', { ascending: false }),
      db.from('files').select('*').eq('project_id', params.id).order('created_at', { ascending: false }),
      db.from('milestones').select('*').eq('project_id', params.id).order('sort_order').order('due_date'),
    ])
  if (error || !project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  return NextResponse.json({ ...project, tasks, invoices, files, milestones })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const { data, error } = await admin().from('projects').update(body).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await admin().from('projects').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
