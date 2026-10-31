import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('full_name,role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'platform_super_admin') redirect('/dashboard')

  const [{ count: businesses }, { count: users }, { count: suppliers }, { count: transactions }] = await Promise.all([
    supabase.from('businesses').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'supplier'),
    supabase.from('sales').select('id', { count: 'exact', head: true }),
  ])

  const metrics = [
    ['Registered businesses', businesses ?? 0],
    ['Platform users', users ?? 0],
    ['Suppliers', suppliers ?? 0],
    ['Transactions', transactions ?? 0],
  ]

  return <main className="min-h-screen bg-[#f6f8fb]">
    <header className="border-b border-slate-200 bg-[#0b1d38] text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
        <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Core Grid Africa</p><h1 className="mt-1 text-xl font-bold">Platform control centre</h1></div>
        <Link href="/dashboard" className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10">Business dashboard</Link>
      </div>
    </header>
    <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
      <div className="mb-8"><p className="text-sm font-semibold text-[#1463df]">Super Admin</p><h2 className="mt-2 text-3xl font-bold text-[#0b1d38]">Platform overview</h2><p className="mt-2 text-slate-600">Monitor businesses, users and marketplace activity from one secure workspace.</p></div>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{metrics.map(([label, value]) => <article key={label as string} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-3 text-3xl font-bold text-[#0b1d38]">{value}</p><p className="mt-2 text-xs text-slate-400">Live from Supabase</p></article>)}</section>
      <section className="mt-8 grid gap-5 lg:grid-cols-3"><article className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-2"><h3 className="text-lg font-bold text-[#0b1d38]">Administration modules</h3><div className="mt-5 grid gap-3 sm:grid-cols-2">{['Business verification','User access management','Marketplace moderation','Subscription plans','Payment history','Platform activity logs'].map((item) => <div key={item} className="rounded-xl bg-slate-50 p-4"><p className="font-semibold text-slate-800">{item}</p><p className="mt-1 text-sm text-slate-500">Protected administrator workflow</p></div>)}</div></article><article className="rounded-2xl bg-[#1463df] p-6 text-white"><p className="text-sm font-semibold text-blue-100">Security status</p><h3 className="mt-2 text-xl font-bold">Server-side access enforced</h3><p className="mt-3 text-sm leading-6 text-blue-100">This route validates the authenticated profile role before any platform metrics are queried.</p></article></section>
    </div>
  </main>
}
