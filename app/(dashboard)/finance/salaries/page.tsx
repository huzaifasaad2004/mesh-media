import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function SalariesPage() {
  const supabase = createClient()
  const { data: salaries } = await supabase
    .from('salaries')
    .select('*, profile:profiles(full_name, email)')
    .order('effective_from', { ascending: false })

  const monthlyTotal = (salaries ?? []).filter(s => !s.effective_to).reduce((sum, s) => sum + (s.amount ?? 0), 0)

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/finance" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="w-4 h-4" /></Link>
          <div>
            <h1>Salaries</h1>
            <p className="text-gray-500 text-sm mt-0.5">{formatCurrency(monthlyTotal)}/month total payroll</p>
          </div>
        </div>
        <Link href="/team" className="btn-secondary">Manage in Team →</Link>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Team Member</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Salary</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Pay Period</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Effective From</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {(salaries ?? []).length > 0 ? (salaries ?? []).map((sal) => (
              <tr key={sal.id} className="table-row">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center text-xs font-bold">
                      {(sal.profile?.full_name ?? 'U')[0]}
                    </div>
                    <span className="font-medium text-gray-900">{sal.profile?.full_name ?? sal.profile?.email ?? '—'}</span>
                  </div>
                </td>
                <td className="px-5 py-3 font-semibold">{formatCurrency(sal.amount)} <span className="text-gray-400 font-normal text-xs">{sal.currency}</span></td>
                <td className="px-5 py-3 text-gray-500 capitalize">{sal.pay_period}</td>
                <td className="px-5 py-3 text-gray-500 text-xs">{formatDate(sal.effective_from)}</td>
                <td className="px-5 py-3">
                  <span className={`badge ${sal.effective_to ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'}`}>
                    {sal.effective_to ? 'Ended' : 'Active'}
                  </span>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} className="px-5 py-16 text-center text-gray-400 text-sm">
                  No salaries set up yet — <Link href="/team" className="text-brand-600 hover:underline">go to Team</Link> to configure them
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
