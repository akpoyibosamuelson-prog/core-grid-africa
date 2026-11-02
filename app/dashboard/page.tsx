import Link from 'next/link'
import { ArrowUpRight, Box, CircleDollarSign, Receipt, Users } from 'lucide-react'
import { DashboardNav } from '@/components/dashboard-nav'
import { createClient } from '@/lib/supabase/server'

function money(value: number, currency = 'NGN') {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
}

export default async function DashboardPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY
  if (!supabaseUrl || !supabaseKey) return <ConnectionState />

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <ConnectionState title="Your session has expired" description="Sign in again to access your workspace." action="Return to sign in" href="/auth/login" />

  const { data: membership } = await supabase.from('business_memberships').select('business_id, role').eq('user_id', user.id).order('created_at').maybeSingle()
  if (!membership) return <ConnectionState title="Set up your workspace" description="Create your business workspace before recording sales, products or expenses." action="Create workspace" href="/onboarding" />

  const { data: business } = await supabase.from('businesses').select('id, name, currency, industry').eq('id', membership.business_id).maybeSingle()
  const [{ data: products }, { data: customers }, { data: expenses }] = await Promise.all([
    supabase.from('products').select('id, name, selling_price, min_stock_level').eq('business_id', membership.business_id).eq('is_archived', false),
    supabase.from('customers').select('id').eq('business_id', membership.business_id),
    supabase.from('expenses').select('amount').eq('business_id', membership.business_id).eq('status', 'approved'),
  ])
  const totalExpenses = (expenses ?? []).reduce((sum, expense) => sum + Number(expense.amount), 0)
  const currency = business?.currency ?? 'NGN'

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-[#0b1d38]">
      <DashboardNav email={user.email} />
      <main className="lg:pl-72">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-5 lg:px-10"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#1463df]">Business overview</p><h1 className="mt-1 text-2xl font-bold">Good morning, {user.user_metadata?.full_name?.split(' ')[0] ?? 'there'}</h1></div><Link href="/dashboard/pos" className="rounded-lg bg-[#1463df] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0b4fb9]">Open POS</Link></header>
        <div className="space-y-8 p-6 lg:p-10">
          <section className="rounded-2xl bg-[#0b1d38] p-6 text-white lg:p-8"><div className="flex flex-wrap items-start justify-between gap-6"><div><p className="text-sm text-slate-300">{business?.name ?? 'Your business'}</p><h2 className="mt-2 text-3xl font-bold">Run your business with clarity.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">Track the records that matter, keep stock moving and make decisions from your actual business data.</p></div><div className="rounded-xl border border-white/10 bg-white/5 p-4 text-right"><p className="text-xs text-slate-400">Plan status</p><p className="mt-1 font-semibold text-[#b6ed3e]">Workspace active</p></div></div></section>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon={CircleDollarSign} label="Approved expenses" value={money(totalExpenses, currency)} detail="From recorded expenses" />
            <Stat icon={Box} label="Active products" value={String(products?.length ?? 0)} detail="In your catalogue" />
            <Stat icon={Users} label="Customers" value={String(customers?.length ?? 0)} detail="Saved in CRM" />
            <Stat icon={Receipt} label="Low stock watch" value={String(products?.filter((product) => product.min_stock_level > 0).length ?? 0)} detail="Products with thresholds" />
          </section>
          <section className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]"><div className="rounded-2xl border border-slate-200 bg-white p-6"><div className="flex items-center justify-between"><div><h2 className="font-bold">Next actions</h2><p className="mt-1 text-sm text-slate-500">Complete your operating foundation.</p></div><ArrowUpRight className="size-5 text-slate-300" /></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><Action href="/dashboard/products" title="Add products" description="Build your catalogue" /><Action href="/dashboard/customers" title="Add customers" description="Start your CRM" /><Action href="/dashboard/expenses" title="Record expense" description="Keep books current" /></div></div><div className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="font-bold">Workspace access</h2><p className="mt-2 text-sm leading-6 text-slate-500">You are signed in as a <span className="font-semibold text-slate-700">{membership.role}</span>. Access is isolated to this business.</p><Link href="/dashboard/settings" className="mt-5 inline-block text-sm font-semibold text-[#1463df]">Manage settings</Link></div></section>
        </div>
      </main>
    </div>
  )
}

function Stat({ icon: Icon, label, value, detail }: { icon: typeof CircleDollarSign; label: string; value: string; detail: string }) { return <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><p className="text-sm text-slate-500">{label}</p><Icon className="size-5 text-[#1463df]" /></div><p className="mt-4 text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-slate-400">{detail}</p></div> }
function Action({ href, title, description }: { href: string; title: string; description: string }) { return <Link href={href} className="rounded-xl border border-slate-200 p-4 transition hover:border-[#1463df] hover:bg-blue-50/40"><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-slate-500">{description}</p></Link> }
function ConnectionState({ title = 'Database connection is being prepared', description = 'The authenticated workspace will be available when the connected Supabase runtime variables are injected into this preview.', action = 'Return to BizPilot', href = '/' }: { title?: string; description?: string; action?: string; href?: string }) { return <main className="grid min-h-screen place-items-center bg-[#f6f8fb] p-6"><div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center"><p className="text-sm font-semibold text-[#1463df]">BizPilot workspace</p><h1 className="mt-2 text-2xl font-bold text-[#0b1d38]">{title}</h1><p className="mt-3 text-sm leading-6 text-slate-500">{description}</p><Link className="mt-6 inline-block rounded-lg bg-[#1463df] px-4 py-2 text-sm font-semibold text-white" href={href}>{action}</Link></div></main> }
