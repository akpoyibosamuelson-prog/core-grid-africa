import Link from 'next/link'
import { redirect } from 'next/navigation'
import { DashboardNav } from '@/components/dashboard-nav'
import { ProductManager } from '@/components/product-manager'
import { createClient } from '@/lib/supabase/server'

export default async function ProductsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: membership } = await supabase.from('business_memberships').select('business_id, businesses(id, name, currency)').eq('user_id', user.id).limit(1).maybeSingle()
  const business = Array.isArray(membership?.businesses) ? membership.businesses[0] : membership?.businesses
  if (!business) return <main className="min-h-screen bg-[#081b16] p-8 text-white"><h1 className="text-2xl font-semibold">Set up your business first</h1><p className="mt-2 text-white/60">Create a business profile before adding products.</p><Link href="/onboarding" className="mt-6 inline-flex rounded-xl bg-lime-300 px-5 py-3 font-semibold text-[#0b241d]">Create business</Link></main>
  const { data: products } = await supabase.from('products').select('id, name, sku, selling_price, cost_price, min_stock_level, inventory(quantity)').eq('business_id', business.id).eq('is_archived', false).order('created_at', { ascending: false })
  return <div className="min-h-screen bg-[#081b16] text-white"><DashboardNav /><main className="md:pl-72"><div className="mx-auto max-w-6xl px-5 py-8 md:px-10"><div className="mb-8"><p className="text-sm text-lime-300">Inventory & products</p><h1 className="mt-2 text-3xl font-semibold">Product catalogue</h1><p className="mt-2 text-white/55">Manage stock, pricing and reorder levels for {business.name}.</p></div><ProductManager businessId={business.id} initialProducts={products ?? []} /></div></main></div>
}
