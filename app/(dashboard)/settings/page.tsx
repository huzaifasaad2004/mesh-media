'use client'

import { useState, useEffect } from 'react'
import { Save, RotateCcw } from 'lucide-react'
import { DEFAULT_TERMS, DEFAULT_INVOICE_NOTES, DEFAULT_QUOTE_NOTES, COMPANY } from '@/lib/company'

const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

const SETTINGS_KEY = 'mesh_company_settings'

function load() {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') } catch { return {} }
}

export default function SettingsPage() {
  const [saved, setSaved] = useState(false)
  const [settings, setSettings] = useState({
    default_terms: DEFAULT_TERMS,
    default_invoice_notes: DEFAULT_INVOICE_NOTES,
    default_quote_notes: DEFAULT_QUOTE_NOTES,
    payment_terms: 'Due on Receipt',
    vat_rate: '0',
  })

  useEffect(() => {
    const stored = load()
    setSettings(s => ({ ...s, ...stored }))
  }, [])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setSettings(p => ({ ...p, [k]: e.target.value }))

  const save = () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const reset = (key: string, def: string) => setSettings(p => ({ ...p, [key]: def }))

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p className="text-gray-500 text-sm mt-0.5">Company defaults for documents and invoicing</p>
        </div>
        <button className="btn-primary" onClick={save}>
          <Save className="w-4 h-4" /> {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 max-w-3xl">

        {/* Company Info (read-only) */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Company Information</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {[
              ['Company Name', COMPANY.name],
              ['Email', COMPANY.email],
              ['Phone', COMPANY.phone],
              ['Website', COMPANY.website],
              ['Address', COMPANY.address + ', ' + COMPANY.city],
              ['Trade License', COMPANY.trade_license],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-gray-500 text-xs mb-0.5">{label}</p>
                <p className="font-medium text-gray-900">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bank Details (read-only) */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Bank Account Details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {[
              ['Bank', COMPANY.bank_name],
              ['Account Name', COMPANY.account_name],
              ['Account Number', COMPANY.account_number],
              ['IBAN', COMPANY.iban],
              ['Branch', COMPANY.branch],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-gray-500 text-xs mb-0.5">{label}</p>
                <p className="font-medium text-gray-900 font-mono text-xs">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Invoice defaults */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Invoice Defaults</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Default Payment Terms</label>
                <select className={inputClass} value={settings.payment_terms} onChange={set('payment_terms')}>
                  <option>Due on Receipt</option>
                  <option>Net 7</option>
                  <option>Net 15</option>
                  <option>Net 30</option>
                  <option>Net 60</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Default VAT Rate (%)</label>
                <select className={inputClass} value={settings.vat_rate} onChange={set('vat_rate')}>
                  <option value="0">0% (No VAT)</option>
                  <option value="5">5% (UAE VAT)</option>
                </select>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={labelClass + ' mb-0'}>Default Invoice Notes</label>
                <button onClick={() => reset('default_invoice_notes', DEFAULT_INVOICE_NOTES)} className="text-xs text-gray-400 hover:text-brand-600 flex items-center gap-1">
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
              </div>
              <textarea className={inputClass} rows={2} value={settings.default_invoice_notes} onChange={set('default_invoice_notes')} />
            </div>
          </div>
        </div>

        {/* Quotation defaults */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Quotation Defaults</h3>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={labelClass + ' mb-0'}>Default Quote Notes</label>
              <button onClick={() => reset('default_quote_notes', DEFAULT_QUOTE_NOTES)} className="text-xs text-gray-400 hover:text-brand-600 flex items-center gap-1">
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
            </div>
            <textarea className={inputClass} rows={2} value={settings.default_quote_notes} onChange={set('default_quote_notes')} />
          </div>
        </div>

        {/* Terms & Conditions */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Default Terms & Conditions</h3>
            <button onClick={() => reset('default_terms', DEFAULT_TERMS)} className="text-xs text-gray-400 hover:text-brand-600 flex items-center gap-1">
              <RotateCcw className="w-3 h-3" /> Reset to default
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-3">These terms auto-fill when you create a new invoice or quotation (you can edit per document).</p>
          <textarea
            className={inputClass}
            rows={10}
            value={settings.default_terms}
            onChange={set('default_terms')}
            style={{ fontFamily: 'monospace', fontSize: 12 }}
          />
        </div>

        {saved && (
          <div className="fixed bottom-6 right-6 bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium">
            Settings saved successfully
          </div>
        )}
      </div>
    </div>
  )
}
