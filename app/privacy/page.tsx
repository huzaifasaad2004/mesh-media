import type { Metadata } from 'next'
import { COMPANY } from '@/lib/company'

export const metadata: Metadata = { title: 'Privacy policy — Mesh Media' }

const UPDATED = '25 November 2026'

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-paper-50 px-5 py-12">
      <article className="mx-auto max-w-2xl text-umber-800 leading-relaxed space-y-5 text-[15px]">
        <h1 className="text-4xl" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Privacy policy</h1>
        <p className="text-sm text-taupe-500">Last updated {UPDATED}</p>
        <p>
          This policy covers the Mesh Media Agency OS website (m3m.ae) and the Mesh Media app for iPhone and Android, run by {COMPANY.name},
          {' '}{COMPANY.address}, {COMPANY.city} (trade licence {COMPANY.trade_license}). They are private tools for our team and our clients — there is no public sign-up.
        </p>

        <h2 className="text-2xl pt-2" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>What we collect</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Account details</strong> — your name, work email, role and (optionally) a profile photo.</li>
          <li><strong>Work records</strong> — tasks, comments, content for approval, meetings, requests, files, invoices, payments and expenses you create or that relate to you.</li>
          <li><strong>Receipt photos</strong> — when you scan a receipt, the photo is stored with the expense and read by an AI service to fill in the amount, date and description.</li>
          <li><strong>Device push token</strong> — so we can send you notifications. Removed when you sign out.</li>
          <li><strong>Basic logs</strong> — sign-in times and an activity log of changes, for security and accounting.</li>
        </ul>
        <p>We don’t use advertising trackers, we don’t sell your data and we don’t track your location.</p>

        <h2 className="text-2xl pt-2" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Camera and photos</h2>
        <p>The app asks for camera or photo access only when you choose to scan a receipt. Only the photo you pick is uploaded.</p>

        <h2 className="text-2xl pt-2" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Who processes it</h2>
        <p>
          Data is stored with Supabase (database and files) and served by Vercel. Emails are sent with Resend, payments are handled by Stripe,
          meetings use Google Calendar/Meet, AI features use Google Gemini, and push notifications go through Expo and Apple/Google.
          Each only receives what it needs to do its job.
        </p>

        <h2 className="text-2xl pt-2" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>How long we keep it</h2>
        <p>
          Account and work data is kept while you work with us. Invoices, payments, contracts and expense records are kept for the period UAE law
          requires for business records, even after an account is closed.
        </p>

        <h2 className="text-2xl pt-2" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Your choices</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Turn email alerts on or off in Notification settings; turn push off in your phone’s settings.</li>
          <li>Ask for a copy of your data, or to correct it, by emailing <a className="underline" href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.</li>
          <li>Delete your account from the app (Account → Delete my account) or by email. We remove your login and personal details within 30 days.</li>
        </ul>

        <h2 className="text-2xl pt-2" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Contact</h2>
        <p>
          {COMPANY.name} · <a className="underline" href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> · {COMPANY.phone}
        </p>
      </article>
    </main>
  )
}
