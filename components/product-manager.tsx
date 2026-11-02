'use client'

import { FormEvent, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Product = {
  id: string
  name: string
  sku: string
  selling_price: number
  cost_price: number
  min_stock_level: number
  inventory?: { quantity: number }[]
}

export function ProductManager({ businessId, initialProducts }: { businessId: string; initialProducts: Product[] }) {
  const [products, setProducts] = useState(initialProducts)
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', sku: '', costPrice: '', sellingPrice: '', quantity: '', minStock: '' })
  const currency = useMemo(() => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }), [])

  async function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const costPrice = Number(form.costPrice)
    const sellingPrice = Number(form.sellingPrice)
    const quantity = Number(form.quantity)
    const minStock = Number(form.minStock)
    if (!form.name.trim() || !form.sku.trim() || !Number.isFinite(sellingPrice) || sellingPrice < 0 || quantity < 0 || minStock < 0) {
      setError('Enter a product name, SKU, valid selling price and non-negative stock values.')
      return
    }
    setIsAdding(true)
    const supabase = createClient()
    const { data: product, error: productError } = await supabase.from('products').insert({
      business_id: businessId,
      name: form.name.trim(),
      sku: form.sku.trim().toUpperCase(),
      cost_price: Number.isFinite(costPrice) ? costPrice : 0,
      selling_price: sellingPrice,
      min_stock_level: minStock,
    }).select('id, name, sku, selling_price, cost_price, min_stock_level').single()
    if (productError || !product) {
      setError(productError?.code === '23505' ? 'That SKU is already in use.' : 'Unable to save this product.')
      setIsAdding(false)
      return
    }
    const { error: inventoryError } = await supabase.from('inventory').insert({ business_id: businessId, product_id: product.id, quantity })
    if (inventoryError) {
      await supabase.from('products').delete().eq('id', product.id)
      setError('The product could not be added to inventory. Please try again.')
      setIsAdding(false)
      return
    }
    setProducts((current) => [{ ...product, inventory: [{ quantity }] }, ...current])
    setForm({ name: '', sku: '', costPrice: '', sellingPrice: '', quantity: '', minStock: '' })
    setIsAdding(false)
  }

  return (
    <section className="space-y-6">
      <form onSubmit={addProduct} className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5 md:grid-cols-3">
        <div className="md:col-span-3"><h2 className="text-base font-semibold text-white">Add product</h2><p className="mt-1 text-sm text-white/50">Create a product and its opening stock record.</p></div>
        <input aria-label="Product name" placeholder="Product name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-lime-300" />
        <input aria-label="SKU" placeholder="SKU e.g. RICE-25KG" value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-lime-300" />
        <input aria-label="Selling price" inputMode="decimal" placeholder="Selling price (NGN)" value={form.sellingPrice} onChange={(event) => setForm({ ...form, sellingPrice: event.target.value })} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-lime-300" />
        <input aria-label="Cost price" inputMode="decimal" placeholder="Cost price (NGN)" value={form.costPrice} onChange={(event) => setForm({ ...form, costPrice: event.target.value })} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-lime-300" />
        <input aria-label="Opening stock" inputMode="numeric" placeholder="Opening stock" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-lime-300" />
        <input aria-label="Minimum stock" inputMode="numeric" placeholder="Minimum stock level" value={form.minStock} onChange={(event) => setForm({ ...form, minStock: event.target.value })} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-lime-300" />
        <div className="flex items-center gap-3 md:col-span-3"><button disabled={isAdding} className="rounded-xl bg-lime-300 px-5 py-3 text-sm font-semibold text-[#0b241d] disabled:opacity-50">{isAdding ? 'Saving…' : 'Add product'}</button>{error && <p role="alert" className="text-sm text-red-300">{error}</p>}</div>
      </form>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"><div className="border-b border-white/10 px-5 py-4"><h2 className="font-semibold text-white">Product catalogue</h2></div><div className="divide-y divide-white/10">{products.length === 0 ? <p className="px-5 py-10 text-center text-sm text-white/45">No products yet. Add your first product above.</p> : products.map((product) => <div key={product.id} className="grid gap-2 px-5 py-4 md:grid-cols-[1fr_120px_140px_120px] md:items-center"><div><p className="font-medium text-white">{product.name}</p><p className="text-xs text-white/40">{product.sku}</p></div><p className="text-sm text-white/65">{currency.format(Number(product.selling_price))}</p><p className="text-sm text-white/65">{product.inventory?.[0]?.quantity ?? 0} in stock</p><span className="text-xs text-white/40">Min {product.min_stock_level}</span></div>)}</div></div>
    </section>
  )
}
