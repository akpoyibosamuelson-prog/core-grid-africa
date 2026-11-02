'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Product = { id: string; name: string; sku: string; selling_price: number; inventory: { quantity: number }[] }
type CartLine = Product & { quantity: number }

export function PosTerminal({ businessId, products }: { businessId: string; products: Product[] }) {
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const visibleProducts = useMemo(() => products.filter((product) => `${product.name} ${product.sku}`.toLowerCase().includes(query.toLowerCase())), [products, query])
  const subtotal = cart.reduce((sum, item) => sum + Number(item.selling_price) * item.quantity, 0)

  function addToCart(product: Product) {
    setMessage('')
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id)
      if (existing) return current.map((item) => item.id === product.id ? { ...item, quantity: Math.min(item.quantity + 1, product.inventory[0]?.quantity ?? 0) } : item)
      return [...current, { ...product, quantity: 1 }]
    })
  }

  async function completeSale() {
    if (!cart.length || subtotal <= 0) return
    setSaving(true)
    setMessage('')
    const supabase = createClient()
    const saleNumber = `BP-${Date.now()}`
    const { error } = await supabase.rpc('record_sale', {
      target_business_id: businessId,
      target_customer_id: null,
      target_sale_number: saleNumber,
      target_subtotal: subtotal,
      target_discount: 0,
      target_tax: 0,
      target_total: subtotal,
      target_payment_method: paymentMethod,
      target_items: cart.map((item) => ({ product_id: item.id, quantity: item.quantity, unit_price: Number(item.selling_price), line_total: Number(item.selling_price) * item.quantity })),
    })
    if (error) setMessage(error.message.includes('insufficient stock') ? 'Not enough stock for one of these items.' : 'Unable to complete this sale.')
    else { setCart([]); setMessage(`Sale ${saleNumber} recorded successfully.`) }
    setSaving(false)
  }

  return <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
    <section className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">Products</h2><p className="mt-1 text-sm text-slate-500">Search by product name or SKU.</p></div><input aria-label="Search products" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#1463df] sm:w-56" /></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visibleProducts.map((product) => { const stock = product.inventory[0]?.quantity ?? 0; return <button key={product.id} type="button" disabled={stock < 1} onClick={() => addToCart(product)} className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-[#1463df] disabled:cursor-not-allowed disabled:opacity-45"><p className="font-semibold">{product.name}</p><p className="mt-1 text-xs text-slate-400">{product.sku}</p><div className="mt-4 flex items-end justify-between"><span className="font-bold text-[#1463df]">₦{Number(product.selling_price).toLocaleString()}</span><span className="text-xs text-slate-500">{stock} in stock</span></div></button> })}{!visibleProducts.length && <p className="col-span-full py-10 text-center text-sm text-slate-500">No matching products. Add products to your catalogue first.</p>}</div></section>
    <section className="rounded-2xl bg-[#0b1d38] p-5 text-white"><div className="flex items-center justify-between"><div><h2 className="font-bold">Current sale</h2><p className="mt-1 text-sm text-slate-300">{cart.length} line item{cart.length === 1 ? '' : 's'}</p></div><span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-300">POS</span></div><div className="mt-5 space-y-3">{cart.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 border-b border-white/10 pb-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{item.name}</p><p className="text-xs text-slate-400">{item.quantity} × ₦{Number(item.selling_price).toLocaleString()}</p></div><button type="button" onClick={() => setCart((current) => current.filter((line) => line.id !== item.id))} className="text-xs text-slate-400 hover:text-white">Remove</button></div>)}{!cart.length && <p className="py-12 text-center text-sm text-slate-400">Select products to start a sale.</p>}</div><div className="mt-6 border-t border-white/10 pt-5"><div className="flex justify-between text-sm text-slate-300"><span>Subtotal</span><span>₦{subtotal.toLocaleString()}</span></div><div className="mt-2 flex justify-between text-lg font-bold"><span>Total</span><span className="text-[#b6ed3e]">₦{subtotal.toLocaleString()}</span></div><label className="mt-5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Payment method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-white/10 px-3 py-2.5 text-sm font-normal normal-case text-white outline-none"><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="card">Card</option></select></label><button type="button" disabled={saving || !cart.length} onClick={completeSale} className="mt-5 w-full rounded-lg bg-[#b6ed3e] px-4 py-3 text-sm font-bold text-[#0b241d] disabled:opacity-40">{saving ? 'Recording sale…' : 'Complete sale'}</button>{message && <p role="status" className="mt-3 text-center text-sm text-slate-300">{message}</p>}</div></section>
  </div>
}
