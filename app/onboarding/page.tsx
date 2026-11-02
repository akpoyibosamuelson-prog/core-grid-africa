'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function OnboardingPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', slug: '', industry: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    const { error: rpcError } = await createClient().rpc('create_business_with_owner', {
      business_name: form.name.trim(),
      business_slug: form.slug.trim() || form.name.trim(),
      business_industry: form.industry || null,
    })

    if (rpcError) {
      setError(rpcError.message.includes('duplicate') ? 'That workspace URL is already in use.' : 'We could not create your workspace. Please try again.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-[#f6f8fb] px-6 py-12 text-[#0b1d38]">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm font-bold tracking-[0.16em] text-[#0b1d38]">
          CORE GRID <span className="text-[#1463df]">AFRICA</span>
        </Link>
        <div className="mt-12 grid gap-10 md:grid-cols-[0.8fr_1.2fr] md:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#1463df]">BizPilot setup</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight">Create your business workspace</h1>
            <p className="mt-4 leading-7 text-slate-500">Your workspace keeps your sales, inventory, customers and financial records private to your business.</p>
          </div>
          <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
            <label className="block text-sm font-semibold">Business name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3 outline-none focus:border-[#1463df]" placeholder="e.g. Amina Foods" /></label>
            <label className="mt-5 block text-sm font-semibold">Workspace URL<input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3 outline-none focus:border-[#1463df]" placeholder="amina-foods" /><span className="mt-1 block text-xs font-normal text-slate-400">Used only as your unique workspace identifier.</span></label>
            <label className="mt-5 block text-sm font-semibold">Industry<select value={form.industry} onChange={(event) => setForm({ ...form, industry: event.target.value })} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 outline-none focus:border-[#1463df]"><option value="">Select an industry</option><option>Retail</option><option>Wholesale</option><option>Restaurant & food</option><option>Professional services</option><option>Manufacturing</option><option>Other</option></select></label>
            {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <button disabled={loading} className="mt-6 w-full rounded-lg bg-[#1463df] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0b4fb9] disabled:cursor-not-allowed disabled:opacity-60">{loading ? 'Creating workspace...' : 'Create workspace'}</button>
          </form>
        </div>
      </div>
    </main>
  )
}
