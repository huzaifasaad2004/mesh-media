export type UserRole = 'admin' | 'staff' | 'viewer'
export type ClientStatus = 'lead' | 'onboarding' | 'active' | 'paused' | 'churned'
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type ContractStatus = 'draft' | 'sent' | 'signed' | 'expired' | 'cancelled'
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
export type ProjectStatus = 'active' | 'completed' | 'paused' | 'cancelled'

export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  role: UserRole
  avatar_url: string | null
  created_at: string
}

export interface Client {
  id: string
  company_name: string
  industry: string | null
  status: ClientStatus
  website: string | null
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  monthly_retainer: number | null
  drive_folder_url: string | null
  created_at: string
  updated_at: string
}

export interface Contact {
  id: string
  client_id: string
  full_name: string
  email: string | null
  phone: string | null
  role: string | null
  is_primary: boolean
  created_at: string
}

export interface ClientNote {
  id: string
  client_id: string
  author_id: string | null
  content: string
  created_at: string
  author?: Profile
}

export interface OnboardingStep {
  id: string
  client_id: string
  title: string
  description: string | null
  is_completed: boolean
  completed_at: string | null
  completed_by: string | null
  sort_order: number
  created_at: string
}

export interface Project {
  id: string
  client_id: string | null
  name: string
  description: string | null
  status: ProjectStatus
  start_date: string | null
  end_date: string | null
  created_at: string
  client?: Client
}

export interface Task {
  id: string
  project_id: string | null
  client_id: string | null
  assigned_to: string | null
  created_by: string | null
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
  created_at: string
  updated_at: string
  assignee?: Profile
  client?: Client
  project?: Project
}

export interface FileRecord {
  id: string
  client_id: string | null
  name: string
  storage_path: string | null
  drive_url: string | null
  file_type: string | null
  file_size: number | null
  uploaded_by: string | null
  category: string | null
  created_at: string
  uploader?: Profile
  client?: Client
}

export interface Contract {
  id: string
  client_id: string
  title: string
  content: string | null
  status: ContractStatus
  value: number | null
  start_date: string | null
  end_date: string | null
  signed_at: string | null
  file_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  client?: Client
}

export interface Invoice {
  id: string
  client_id: string
  contract_id: string | null
  invoice_number: string
  status: InvoiceStatus
  issue_date: string
  due_date: string | null
  paid_date: string | null
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  notes: string | null
  created_at: string
  updated_at: string
  client?: Client
  items?: InvoiceItem[]
}

export interface InvoiceItem {
  id: string
  invoice_id: string
  description: string
  quantity: number
  unit_price: number
  amount: number
  sort_order: number
}

export interface Expense {
  id: string
  client_id: string | null
  category: string
  description: string
  amount: number
  date: string
  receipt_url: string | null
  created_by: string | null
  created_at: string
  client?: Client
}

export interface Salary {
  id: string
  profile_id: string
  amount: number
  currency: string
  pay_period: string
  effective_from: string
  effective_to: string | null
  notes: string | null
  created_at: string
  profile?: Profile
}

export interface SalaryPayment {
  id: string
  profile_id: string
  salary_id: string | null
  amount: number
  payment_date: string
  notes: string | null
  created_by: string | null
  created_at: string
  profile?: Profile
}
