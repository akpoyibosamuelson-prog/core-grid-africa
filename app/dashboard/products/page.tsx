import Link from 'next/link'
import { Plus, Package, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export default async function ProductsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <main className="grid min-h-screen place-items-center"><Link href="/auth/login" className="text-blue-600">Return to sign in</Link></main>

  const { data: business } = await supabase.from('businesses').select('id,name').eq('owner_id', user.id).maybeSingle()
  const { data: products } = business ? await supabase.from('products').select('id,name,sku,stock_quantity,low_stock_threshold,retail_price,wholesale_price').eq('business_id', business.id).eq('is_archived', false).order('created_at', { ascending: false }) : { data: [] }

  return <main className="min-h-screen bg-[#f6f8fb] px-5 py-8 text-slate-950 lg:ml-64 lg:px-10">
    <div className="mx-auto max-w-6xl">
      <Link href="/dashboard" className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"><ArrowLeft className="size-4" />Back to overview</Link>
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#1463df]">Inventory</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Products</h1><p className="mt-2 text-slate-500">Manage your catalog, pricing, and stock levels.</p></div><button className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1463df] px-4 py-2.5 text-sm font-semibold text-white shadow-sm"><Plus className="size-4" />Add product</button></div>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4"><Package className="size-5 text-[#1463df]" /><span className="font-semibold">{products?.length ?? 0} active products</span></div>{products?.length ? <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-6 py-3">Product</th><th className="px-6 py-3">SKU</th><th className="px-6 py-3">Stock</th><th className="px-6 py-3">Retail</th><th className="px-6 py-3">Wholesale</th></tr></thead><tbody className="divide-y divide-slate-100">{products.map((product) => <tr key={product.id} className="hover:bg-slate-50"><td className="px-6 py-4 font-medium">{product.name}</td><td className="px-6 py-4 text-slate-500">{product.sku || '—'}</td><td className="px-6 py-4"><span className={product.stock_quantity <= product.low_stock_threshold ? 'font-semibold text-amber-600' : 'text-slate-700'}>{product.stock_quantity}</span>{product.stock_quantity <= product.low_stock_threshold && <span className="ml-2 text-xs text-amber-600">Low stock</span>}</td><td className="px-6 py-4">₦{Number(product.retail_price).toLocaleString()}</td><td className="px-6 py-4">₦{Number(product.wholesale_price).toLocaleString()}</td></tr>)}</tbody></table></div> : <div className="grid place-items-center px-6 py-20 text-center"><Package className="size-10 text-slate-300" /><h2 className="mt-4 font-semibold">Your catalog is ready</h2><p className="mt-2 max-w-sm text-sm text-slate-500">Add your first product to start tracking stock and sales in BizPilot.</p></div>}</section>
    </div>
  </main>
}
