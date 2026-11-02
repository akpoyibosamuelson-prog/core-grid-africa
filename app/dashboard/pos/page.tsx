import Link from 'next/link'
import { DashboardNav } from '@/components/dashboard-nav'
import { PosTerminal } from '@/components/pos-terminal'
import { createClient } from '@/lib/supabase/server'

export default async function PosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <main className="grid min-h-screen place-items-center bg-[#f6f8fb] p-6"><Link href="/auth/login" className="rounded-lg bg-[#1463df] px-4 py-2 text-sm font-semibold text-white">Sign in to open POS</Link></main>
  const { data: membership } = await supabase.from('business_memberships').select('business_id').eq('user_id', user.id).order('created_at').maybeSingle()
  if (!membership) return <main className="grid min-h-screen place-items-center bg-[#f6f8fb] p-6"><Link href="/onboarding" className="rounded-lg bg-[#1463df] px-4 py-2 text-sm font-semibold text-white">Create your workspace</Link></main>
  const { data: products } = await supabase.from('products').select('id, name, sku, selling_price, inventory(quantity)').eq('business_id', membership.business_id).eq('is_archived', false).order('name')
  return <div className="min-h-screen bg-[#f6f8fb] text-[#0b1d38]"><DashboardNav email={user.email} /><main className="lg:pl-72"><header className="border-b border-slate-200 bg-white px-6 py-5 lg:px-10"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#1463df]">Sales & revenue</p><h1 className="mt-1 text-2xl font-bold">Point of Sale</h1><p className="mt-2 text-sm text-slate-500">Record a sale and update inventory in one secure transaction.</p></header><div className="p-6 lg:p-10"><PosTerminal businessId={membership.business_id} products={products ?? []} /></div></main></div>
}
